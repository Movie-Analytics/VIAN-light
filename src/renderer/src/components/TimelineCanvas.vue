<template>
  <div>
    <canvas ref="canvas" height="0"></canvas>
    <canvas ref="hiddenCanvas" height="0" class="d-none"></canvas>
  </div>
</template>

<script>
import { mapStores } from 'pinia'
import * as d3 from 'd3'

import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  data() {
    return {
      data: [],
      transform: d3.zoomIdentity,
      elements: undefined,
      ctx: undefined,
      hCtx: undefined,
      scale: undefined,
      resizeoberserver: null,
      canvasWidth: 500,
      canvasHeight: 0,
      zoom: null,
      unloadedImages: 0
    }
  },
  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore)
  },
  watch: {
    'undoableStore.timelines': {
      deep: true,
      handler() {
        this.drawSetup()
        this.draw()
      }
    },
    'mainStore.videoDuration'() {
      if (this.mainStore.videoDuration && this.mainStore.fps) {
        this.drawSetup()
      }
    },
    'mainStore.fps'() {
      if (this.mainStore.videoDuration && this.mainStore.fps) {
        this.drawSetup()
      }
    },
    'tempStore.playPosition'() {
      this.draw()
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
    this.drawSetup()
    this.draw()
  },
  beforeUnmount() {
    this.resizeoberserver.unobserve(this.$refs.canvas)
  },
  methods: {
    onCanvasResize() {
      if (this.ctx == undefined) return

      this.resize()
      this.draw()
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
    drawSetup() {
      this.data = []

      for (const [timeline_i, timeline] of this.undoableStore.timelines.entries()) {
        for (const [shot_i, shot] of timeline.data.entries()) {
          if (timeline.type === 'shots') {
            let color = '#cccccc'
            if (shot_i % 2 == 0) color = '#eeeeee'
            this.data.push({
              x: shot.start,
              y: timeline_i * 48 + 30 + 2,
              width: shot.end - shot.start,
              height: 44,
              fill: color,
              timeline: timeline.id,
              id: shot.id,
              selected: this.tempStore.selectedSegments.has(shot.id),
              type: 'shot'
            })
          } else if (timeline.type.startsWith('screenshots')) {
            this.data.push({
              x: shot.frame,
              y: timeline_i * 48 + 30 + 2,
              width: 44 * (16 / 9),
              height: 44,
              timeline: timeline.id,
              id: shot.id,
              selected: this.tempStore.selectedSegments.has(shot.id),
              type: 'screenshot',
              uri: shot.thumbnail
            })
            // only re-draw after 200 new images were loaded
            if (!this.tempStore.imageCache.has(shot.thumbnail)) {
              this.unloadedImages++
              d3.image(shot.thumbnail).then((img) => {
                this.tempStore.imageCache.set(shot.thumbnail, img)
                this.unloadedImages--
                if (this.unloadedImages % 200 == 0) this.draw()
              })
            }
          }
        }
      }

      const element = document.createElement('custom')
      const elements = d3.select(element)
      const updateSelection = elements.selectAll('.element').data(this.data)
      const enteringElements = updateSelection.enter().append('custom').attr('class', 'element')
      this.elements = enteringElements

      this.zoom = d3
        .zoom()
        .scaleExtent([1, this.mainStore.videoDuration * 0.15])
        .on('zoom', ({ transform }) => {
          this.transform = transform
          this.draw()
        })

      const canvas = d3.select(this.$refs.canvas).call(this.zoom)
      this.ctx = canvas.node().getContext('2d')

      // picking: selection happens via a hidden canvas that has the same
      // elements with each in a different color
      const hCanvas = d3.select(this.$refs.hiddenCanvas)
      let colorI = 10
      this.hCtx = hCanvas.node().getContext('2d')
      this.elements.each((d) => {
        d.hiddenColor = '#' + colorI.toString(16).padStart(6, '0')
        colorI = colorI + 20
        d.hiddenLeftHandle = '#' + colorI.toString(16).padStart(6, '0')
        colorI = colorI + 20
        d.hiddenRightHandle = '#' + colorI.toString(16).padStart(6, '0')
        colorI = colorI + 20
      })

      this.resize()
    },
    clickHandler(event) {
      const coord = d3.pointer(event, this.$refs.canvas)
      const colorData = this.hCtx.getImageData(coord[0], coord[1], 1, 1).data
      const color = this.rgbToHex(colorData[0], colorData[1], colorData[2])
      const entries = this.data.filter((d) => d.hiddenColor == color)

      if (entries.length == 0 && coord[1] < 40) {
        // set player position
        const timePosition =
          this.transform.rescaleX(this.scale).invert(coord[0]) / this.mainStore.fps
        this.tempStore.playJumpPosition = timePosition
        return
      } else if (entries.length > 0) {
        // select shots
        const entry = entries[0]
        if (
          this.tempStore.selectedSegments.size > 0 &&
          this.tempStore.selectedSegments.values().next().value !== entry.timeline
        ) {
          // only allow selection from the same timeline
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        } else if (this.tempStore.selectedSegments.has(entry.id)) {
          // click on selected element de-selects it
          this.tempStore.selectedSegments.delete(entry.id)
        } else if (!event.ctrlKey) {
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        } else {
          this.tempStore.selectedSegments.set(entry.id, entry.timeline)
        }
        this.draw()
      }
    },
    mousedown(e) {
      this.tempStore.tmpShot = null
      if (e.altKey | e.shiftKey) e.stopImmediatePropagation()
      // new timeline segment
      if (e.altKey) {
        const coord = d3.pointer(e, this.$refs.canvas)
        if (coord[1] < 40) return
        const nTimeline = Math.floor((coord[1] - 32) / 48)
        if (this.undoableStore.timelines[nTimeline].type !== 'shots') return
        const height = nTimeline * 48 + 32
        const start = this.transform.rescaleX(this.scale).invert(coord[0])
        this.tempStore.tmpShot = {
          origin: start,
          start: start,
          y: height,
          end: start,
          height: 44,
          originalShot: null
        }
        return
      }
      // move boundary of existing segment
      const coord = d3.pointer(e, this.$refs.canvas)
      const colorData = this.hCtx.getImageData(coord[0], coord[1], 1, 1).data
      const color = this.rgbToHex(colorData[0], colorData[1], colorData[2])
      if (color === '#000000') return
      const entries = this.data.filter(
        (d) => d.hiddenLeftHandle === color || d.hiddenRightHandle === color
      )
      if (entries.length == 0) return
      e.stopImmediatePropagation()
      const entry = entries[0]
      this.tempStore.tmpShot = {
        origin: entry.hiddenLeftHandle === color ? entry.x + entry.width : entry.x,
        start: entry.start,
        y: entry.y,
        end: entry.x + entry.width,
        height: 44,
        originalShot: entry
      }
    },
    mousemove(e) {
      if (e.buttons !== 1 || this.tempStore.tmpShot === null) return
      if (e.altKey || e.shiftKey) e.stopImmediatePropagation()

      const coord = d3.pointer(e, this.$refs.canvas)
      const xNew = Math.round(this.transform.rescaleX(this.scale).invert(coord[0]))

      this.tempStore.tmpShot.start = Math.min(this.tempStore.tmpShot.origin, xNew)
      this.tempStore.tmpShot.end = Math.max(this.tempStore.tmpShot.origin, xNew)

      this.tempStore.playJumpPosition = xNew / this.mainStore.fps
    },
    mouseleave() {
      if (this.tempStore.tmpShot !== null) {
        this.tempStore.tmpShot = null
        console.log('mouseleave')
        this.draw()
      }
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
      }
      this.tempStore.tmpShot = null
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

      this.ctx.strokeStyle = 'black'

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
      this.ctx.fillStyle = 'black'
      ticks.forEach((d) => {
        this.ctx.beginPath()
        this.ctx.fillText(tickFormat(d), transScale(d), Y + tickSize + textMargin)
      })
    },
    drawTimelines(rescale) {
      if (this.elements === undefined) return
      const hCtx = this.hCtx
      const ctx = this.ctx
      hCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const selectedSegments = new Set(this.tempStore.selectedSegments.keys())

      this.elements.each((d) => {
        hCtx.fillStyle = d.hiddenColor

        const x = Math.round(rescale(d.x))
        const xwidth = Math.round(rescale(d.x + d.width))
        if (d.type === 'shot') {
          ctx.fillStyle = selectedSegments.has(d.id) ? 'yellow' : d.fill
          ctx.fillRect(x, d.y, xwidth - x, d.height)
          hCtx.fillRect(x, d.y, xwidth - x, d.height)

          // draw handles for grabbing
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
    },
    draw() {
      const ctx = this.ctx
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const rescale = this.transform.rescaleX(this.scale)

      this.drawTimelines(rescale)
      this.drawTmpShot(rescale)

      // draw current play position
      ctx.beginPath()
      ctx.strokeStyle = 'red'
      ctx.lineWidth = '2'
      const playPosition = Math.round(rescale(this.tempStore.playPosition * this.mainStore.fps))
      ctx.moveTo(playPosition, 0)
      ctx.lineTo(playPosition, this.canvasHeight)
      ctx.stroke()

      this.drawAxis()

    },
    rgbToHex(r, g, b) {
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
