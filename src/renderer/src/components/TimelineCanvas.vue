<template>
  <div>
    <canvas ref="canvas" height="0"></canvas>

    <canvas ref="hiddenCanvas" height="0" class="d-none"></canvas>
  </div>
</template>

<script>
import * as d3 from 'd3'
import { mapStores } from 'pinia'

import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'TimelineCanvas',

  data() {
    return {
      axisColor: 'black',
      canvasHeight: 0,
      canvasWidth: 500,
      ctx: null,
      data: [],
      hCtx: null,
      isDrawingScheduled: false,
      resizeoberserver: null,
      scale: null,
      transform: d3.zoomIdentity,
      unloadedImages: 0,
      zoom: null
    }
  },

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore)
  },

  watch: {
    '$vuetify.theme.global.name'(val) {
      if (val === 'dark') {
        this.axisColor = 'white'
      } else {
        this.axisColor = 'black'
      }
      this.requestDraw()
    },

    'mainStore.fps'() {
      if (this.mainStore.videoDuration && this.mainStore.fps) {
        this.drawSetup()
      }
    },

    'mainStore.videoDuration'() {
      if (this.mainStore.videoDuration && this.mainStore.fps) {
        this.drawSetup()
        this.requestDraw()
      }
    },

    'tempStore.playPosition'() {
      this.requestDraw()
    },

    'undoableStore.timelines': {
      deep: true,

      handler() {
        this.drawSetup()
        this.requestDraw()
      }
    }
  },

  mounted() {
    this.resizeoberserver = new ResizeObserver(this.onCanvasResize)
    this.resizeoberserver.observe(this.$refs.canvas)

    d3.select(this.$refs.canvas).on('click', (e) => this.clickHandler(e))
    d3.select(this.$refs.canvas).on('mousedown', (e) => this.mousedown(e))
    d3.select(this.$refs.canvas).on('mouseleave', (e) => this.mouseleave(e))
    d3.select(this.$refs.canvas).on('mousemove', (e) => this.mousemove(e))
    d3.select(this.$refs.canvas).on('mouseup', (e) => this.mouseup(e))
    d3.select(this.$refs.canvas).on('dblclick', (e) => {
      e.stopImmediatePropagation()
    })
    d3.select(this.$refs.canvas).on('wheel', (e) => {
      this.zoom.translateBy(d3.select(e.currentTarget), e.wheelDeltaX / this.transform.k, 0)
      this.requestDraw()
    })
    this.drawSetup()
    this.requestDraw()
  },

  beforeUnmount() {
    this.resizeoberserver.unobserve(this.$refs.canvas)
  },

  methods: {
    clickHandler(event) {
      const coord = d3.pointer(event, this.$refs.canvas)
      const colorData = this.hCtx.getImageData(coord[0], coord[1], 1, 1).data
      const color = this.rgbToHex(colorData[0], colorData[1], colorData[2])
      const entries = this.data.filter((d) => d.hiddenColor === color)

      if (entries.length === 0 && coord[1] < 40) {
        // Set player position
        const timePosition =
          this.transform.rescaleX(this.scale).invert(coord[0]) / this.mainStore.fps
        this.tempStore.playJumpPosition = timePosition
      } else if (entries.length > 0) {
        // Select shots
        const [entry] = entries
        if (
          this.tempStore.selectedSegments.size > 0 &&
          this.tempStore.selectedSegments.values().next().value !== entry.timeline
        ) {
          // Only allow selection from the same timeline
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        } else if (this.tempStore.selectedSegments.has(entry.id)) {
          // Click on selected element de-selects it
          this.tempStore.selectedSegments.delete(entry.id)
        } else if (event.metaKey || event.ctrlKey) {
          // Try both key and ctrlKey for macOS
          this.tempStore.selectedSegments.set(entry.id, entry.timeline)
        } else {
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        }
        this.requestDraw()
      }
    },

    draw() {
      const { ctx } = this
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const rescale = this.transform.rescaleX(this.scale)

      this.drawTimelines(rescale)
      this.drawTmpShot(rescale)

      // Draw current play position
      ctx.beginPath()
      ctx.strokeStyle = 'red'
      ctx.lineWidth = '2'
      const playPosition = Math.round(rescale(this.tempStore.playPosition * this.mainStore.fps))
      ctx.moveTo(playPosition, 0)
      ctx.lineTo(playPosition, this.canvasHeight)
      ctx.stroke()

      this.drawAxis()
    },

    drawAxis() {
      const transScale = this.transform.rescaleX(this.scale)
      const tickSize = 6
      const Y = 4
      const textMargin = 3
      const ticks = transScale.ticks(6)
      const tickFormat = (d) => {
        return this.mainStore.timeReadableSec(Math.round(d / this.mainStore.fps))
      }

      this.ctx.strokeStyle = this.axisColor

      this.ctx.beginPath()

      ticks.forEach((d) => {
        this.ctx.moveTo(transScale(d), Y)
        this.ctx.lineTo(transScale(d), Y + tickSize)
      })
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(0, Y)
      this.ctx.lineTo(this.canvasWidth, Y)
      this.ctx.stroke()

      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'top'
      this.ctx.fillStyle = this.axisColor
      ticks.forEach((d) => {
        this.ctx.beginPath()
        this.ctx.fillText(tickFormat(d), transScale(d), Y + tickSize + textMargin)
      })
    },

    drawSetup() {
      this.data = []

      for (const [timelineIndex, timeline] of this.undoableStore.timelines.entries()) {
        for (const [shotIndex, shot] of timeline.data.entries()) {
          if (timeline.type === 'shots') {
            let color = '#aaaaaa'
            if (shotIndex % 2 === 0) color = '#cccccc'
            if (shot.locked) color = '#eeeeee'
            this.data.push({
              annotation: (shot.annotation || '').replace('\n', ' ').slice(0, 40),
              fill: color,
              height: 44,
              id: shot.id,
              locked: shot.locked,
              selected: this.tempStore.selectedSegments.has(shot.id),
              timeline: timeline.id,
              type: 'shot',
              width: shot.end - shot.start,
              x: shot.start,
              y: timelineIndex * 48 + 30 + 2
            })
          } else if (timeline.type.startsWith('screenshots')) {
            this.data.push({
              height: 44,
              id: shot.id,
              selected: this.tempStore.selectedSegments.has(shot.id),
              timeline: timeline.id,
              type: 'screenshot',
              uri: shot.thumbnail,
              width: 44 * (16 / 9),
              x: shot.frame,
              y: timelineIndex * 48 + 30 + 2
            })
            // Only re-draw after 200 new images were loaded
            if (!this.tempStore.imageCache.has(shot.thumbnail)) {
              this.unloadedImages += 1
              d3.image(shot.thumbnail)
                .then((img) => {
                  this.tempStore.imageCache.set(shot.thumbnail, img)
                })
                .catch((err) => {
                  console.error('Error loading thumbnail', err)
                })
                .finally(() => {
                  this.unloadedImages -= 1
                  if (this.unloadedImages % 200 === 0) this.requestDraw()
                })
            }
          }
        }
      }

      this.zoom = d3
        .zoom()
        .scaleExtent([1, this.mainStore.videoDuration * 0.15])
        .on('zoom', ({ transform }) => {
          this.transform = transform
          this.requestDraw()
        })

      const canvas = d3.select(this.$refs.canvas).call(this.zoom)
      this.ctx = canvas.node().getContext('2d')

      // Picking: selection happens via a hidden canvas that has the same
      // elements with each in a different color
      const hCanvas = d3.select(this.$refs.hiddenCanvas)
      let colorI = 10
      this.hCtx = hCanvas.node().getContext('2d')
      this.data.forEach((d) => {
        d.hiddenColor = '#' + colorI.toString(16).padStart(6, '0')
        colorI += 20
        d.hiddenLeftHandle = '#' + colorI.toString(16).padStart(6, '0')
        colorI += 20
        d.hiddenRightHandle = '#' + colorI.toString(16).padStart(6, '0')
        colorI += 20
      })

      this.resize()
    },

    drawTimelines(rescale) {
      if (this.data.length === 0) return
      const { hCtx, ctx } = this
      hCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const selectedSegments = new Set(this.tempStore.selectedSegments.keys())
      ctx.textAlign = 'left'

      this.data.forEach((d) => {
        hCtx.fillStyle = d.hiddenColor

        const x = Math.round(rescale(d.x))
        const xwidth = Math.round(rescale(d.x + d.width))
        if (xwidth < 0 || x > this.canvasWidth || xwidth - x <= 0) return
        if (d.type === 'shot') {
          ctx.save()
          ctx.font = '15px Arial'
          ctx.beginPath()
          ctx.fillStyle = selectedSegments.has(d.id) ? 'yellow' : d.fill
          ctx.fillRect(x, d.y, xwidth - x, d.height)
          ctx.rect(x, d.y, xwidth - x, d.height)
          ctx.fillStyle = 'black'
          ctx.clip()
          ctx.fillText(d.annotation, x, d.y + 10)
          ctx.restore()
          hCtx.fillRect(x, d.y, xwidth - x, d.height)

          // Draw handles for grabbing
          ctx.globalAlpha = 0.1
          ctx.fillStyle = 'black'
          const resizeWidth = Math.round(rescale(d.x + Math.min(d.width * 0.2, 20)) - x)
          ctx.fillRect(x, d.y, resizeWidth, 20)
          ctx.fillRect(xwidth - resizeWidth, d.y, resizeWidth, 20)
          hCtx.fillStyle = d.hiddenLeftHandle
          hCtx.fillRect(x, d.y, resizeWidth, 20)
          hCtx.fillStyle = d.hiddenRightHandle
          hCtx.fillRect(xwidth - resizeWidth, d.y, resizeWidth, 20)
          ctx.globalAlpha = 1.0
        } else if (d.type === 'screenshot') {
          const image = this.tempStore.imageCache.get(d.uri)
          if (!image) return
          if (selectedSegments.has(d.id)) {
            ctx.fillStyle = 'yellow'
            ctx.fillRect(x, d.y, d.width, d.height)
            ctx.globalAlpha = 0.5
          }
          ctx.drawImage(this.tempStore.imageCache.get(d.uri), x, d.y, d.width, d.height)
          ctx.globalAlpha = 1.0
          hCtx.fillRect(x, d.y, d.width, d.height)
        }
      })
    },

    drawTmpShot(rescale) {
      if (this.tempStore.tmpShot === null) return
      this.ctx.fillStyle = 'yellow'
      this.ctx.fillRect(
        rescale(this.tempStore.tmpShot.start),
        this.tempStore.tmpShot.y,
        rescale(this.tempStore.tmpShot.end) - rescale(this.tempStore.tmpShot.start),
        this.tempStore.tmpShot.height
      )

      if (this.tempStore.adjacentShot === null) return
      this.ctx.fillStyle = 'orange'
      this.ctx.fillRect(
        rescale(this.tempStore.adjacentShot.start),
        this.tempStore.adjacentShot.y,
        rescale(this.tempStore.adjacentShot.end) - rescale(this.tempStore.adjacentShot.start),
        this.tempStore.adjacentShot.height
      )
    },

    mousedown(e) {
      this.tempStore.tmpShot = null
      if (e.altKey || e.shiftKey) e.stopImmediatePropagation()
      // New timeline segment
      if (e.altKey) {
        const coord = d3.pointer(e, this.$refs.canvas)
        if (coord[1] < 40) return
        const nTimeline = Math.floor((coord[1] - 32) / 48)
        if (this.undoableStore.timelines[nTimeline].type !== 'shots') return
        const height = nTimeline * 48 + 32
        const start = this.transform.rescaleX(this.scale).invert(coord[0])
        this.tempStore.tmpShot = {
          end: start,
          height: 44,
          origin: start,
          originalShot: null,
          start,
          y: height
        }
        return
      }
      // Move boundary of existing segment
      const coord = d3.pointer(e, this.$refs.canvas)
      const colorData = this.hCtx.getImageData(coord[0], coord[1], 1, 1).data
      const color = this.rgbToHex(colorData[0], colorData[1], colorData[2])
      if (color === '#000000') return
      const entries = this.data.filter(
        (d) => d.hiddenLeftHandle === color || d.hiddenRightHandle === color
      )
      if (entries.length === 0) return
      e.stopImmediatePropagation()
      const [entry] = entries

      if (entry.locked) {
        return
      }

      this.tempStore.tmpShot = {
        end: entry.x + entry.width,
        height: 44,
        origin: entry.hiddenLeftHandle === color ? entry.x + entry.width : entry.x,
        originalShot: entry,
        start: entry.start,
        y: entry.y
      }

      if (e.shiftKey) {
        const currentIndex = this.data.indexOf(entry)
        const leftSide = entry.hiddenLeftHandle === color
        const adjacent = leftSide ? this.data[currentIndex - 1] : this.data[currentIndex + 1]
        if (adjacent.locked) {
          this.tempStore.tmpShot = null
          return
        }

        if (adjacent?.timeline === entry.timeline) {
          this.tempStore.adjacentShot = {
            diff: leftSide
              ? entry.x - (adjacent.x + adjacent.width)
              : adjacent.x - (entry.x + entry.width),

            end: adjacent.x + adjacent.width,
            height: 44,
            leftSide,
            originalShot: adjacent,
            start: adjacent.x,
            y: adjacent.y
          }
        }
      }
    },

    mouseleave() {
      if (this.tempStore.tmpShot !== null) {
        this.tempStore.tmpShot = null
        this.tempStore.adjacentShot = null
        this.requestDraw()
      }
    },

    mousemove(e) {
      if (e.buttons !== 1 || this.tempStore.tmpShot === null) return
      if (e.altKey || e.shiftKey) e.stopImmediatePropagation()

      const coord = d3.pointer(e, this.$refs.canvas)
      const xNew = Math.round(this.transform.rescaleX(this.scale).invert(coord[0]))

      this.tempStore.tmpShot.start = Math.min(this.tempStore.tmpShot.origin, xNew)
      this.tempStore.tmpShot.end = Math.max(this.tempStore.tmpShot.origin, xNew)

      if (e.shiftKey && this.tempStore.adjacentShot) {
        if (this.tempStore.adjacentShot.leftSide) {
          this.tempStore.adjacentShot.end =
            this.tempStore.tmpShot.start - this.tempStore.adjacentShot.diff
        } else {
          this.tempStore.adjacentShot.start =
            this.tempStore.tmpShot.end + this.tempStore.adjacentShot.diff
        }
      }

      this.requestDraw()
      this.tempStore.playJumpPosition = xNew / this.mainStore.fps
    },

    mouseup(e) {
      if (this.tempStore.tmpShot === null) return
      e.stopImmediatePropagation()
      const coord = d3.pointer(e, this.$refs.canvas)
      if (this.tempStore.tmpShot.originalShot === null) {
        this.undoableStore.addShotToNth(
          Math.floor((coord[1] - 32) / 48),
          this.tempStore.tmpShot.start,
          this.tempStore.tmpShot.end
        )
      } else {
        this.undoableStore.changeShotBoundaries(
          this.tempStore.tmpShot.originalShot.id,
          this.tempStore.tmpShot.start,
          this.tempStore.tmpShot.end
        )

        if (e.shiftKey && this.tempStore.adjacentShot) {
          this.undoableStore.changeShotBoundaries(
            this.tempStore.adjacentShot.originalShot.id,
            this.tempStore.adjacentShot.start,
            this.tempStore.adjacentShot.end
          )
        }
      }
      this.tempStore.tmpShot = null
      this.tempStore.adjacentShot = null
    },

    onCanvasResize() {
      if (this.ctx === null) return

      this.resize()
      this.requestDraw()
    },

    requestDraw() {
      if (!this.isDrawingScheduled) {
        this.isDrawingScheduled = true
        requestAnimationFrame(() => {
          this.draw()
          this.isDrawingScheduled = false
        })
      }
    },

    resize() {
      this.canvasWidth = this.$refs.canvas.parentElement.offsetWidth
      this.canvasHeight = this.undoableStore.timelines.length * 48 + 30
      d3.select(this.$refs.canvas).attr('width', this.canvasWidth).attr('height', this.canvasHeight)
      d3.select(this.$refs.hiddenCanvas)
        .attr('width', this.canvasWidth)
        .attr('height', this.canvasHeight)
      const timelineLength = this.mainStore.videoDuration * this.mainStore.fps
      this.scale = d3.scaleLinear([0, timelineLength], [0, this.canvasWidth])
      this.zoom.translateExtent([
        [0, 0],
        [this.canvasWidth, 150]
      ])
    },

    rgbToHex(r, g, b) {
      // eslint-disable-next-line
      return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toLowerCase()
    }
  }
}
</script>

<style scoped>
canvas {
  width: 100%;
}
</style>
