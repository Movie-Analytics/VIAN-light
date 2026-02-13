<template>
  <div class="position-relative w-100">
    <canvas ref="canvas" height="0"></canvas>

    <v-overlay v-model="overlayInput" contained>
      <v-text-field
        ref="overlayTextfield"
        v-model="overlayInputModel"
        :label="$t('components.timelineCanvas.annotations')"
        min-width="200"
        hide-details="true"
        variant="solo"
        density="compact"
        class="bg-blue-grey-lighten-5 position-absolute"
        @change="overlayInputChange"
        @keyup.enter="overlayInputChange"
      ></v-text-field>
    </v-overlay>

    <canvas ref="hiddenCanvas" height="0" class="d-none"></canvas>
  </div>
</template>

<script>
import * as d3 from 'd3'
import { mapStores } from 'pinia'

import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

const TIMELINE_HEIGHT = 48
const AXES_HEIGHT = 32

export default {
  name: 'TimelineCanvas',

  data() {
    return {
      axisColor: 'black',
      canvasHeight: 0,
      canvasWidth: 500,
      ctx: null,
      data: [],
      dpr: window.devicePixelRatio || 1,
      hCtx: null,
      isDrawingScheduled: false,
      lastClick: Date.now(),
      numTimelines: 0,
      overlayInput: false,
      overlayInputEntry: null,
      overlayInputModel: '',
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

    'tempStore.timelinesFold': {
      deep: true,

      handler() {
        this.drawSetup()
        this.requestDraw()
      }
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
      const rect = this.$refs.canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) * this.dpr
      const y = (event.clientY - rect.top) * this.dpr
      const colorData = this.hCtx.getImageData(x, y, 1, 1).data
      const color = this.rgbToHex(colorData[0], colorData[1], colorData[2])
      const entries = this.data.filter((d) => d.hiddenColor === color)

      // Convert coordinates back to logical space for calculations
      const coordX = event.clientX - rect.left
      const coordY = event.clientY - rect.top

      if (entries.length === 0 && coordY < 40) {
        // Set player position
        const timePosition = this.transform.rescaleX(this.scale).invert(coordX) / this.mainStore.fps
        this.tempStore.playJumpPosition = timePosition
      } else if (entries.length > 0) {
        // Select shots
        const [entry] = entries
        if (entry.type === 'select') {
          this.undoableStore.addVocabAnnotation(entry.id, entry.tag)
        } else if (Date.now() - this.lastClick < 500) {
          this.doubleClickPopup(entry)
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        } else if (
          this.tempStore.selectedSegments.size > 0 &&
          this.tempStore.selectedSegments.values().next().value !== entry.timeline
        ) {
          // Only allow selection from the same timeline
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        } else if (event.metaKey || event.ctrlKey) {
          // Try both key and ctrlKey for macOS
          if (this.tempStore.selectedSegments.has(entry.id)) {
            // Click on selected element de-selects it
            this.tempStore.selectedSegments.delete(entry.id)
          } else {
            this.tempStore.selectedSegments.set(entry.id, entry.timeline)
          }
        } else {
          this.tempStore.selectedSegments = new Map([[entry.id, entry.timeline]])
        }
        this.requestDraw()
      }
      this.lastClick = Date.now()
    },

    doubleClickPopup(entry) {
      this.overlayInput = true
      this.$nextTick().then(() => {
        const x = Math.round(this.transform.rescaleX(this.scale)(entry.x))
        // Stay within canvas
        const leftPos = Math.min(Math.max(x, 0), this.$refs.canvas.offsetWidth - 200)
        this.$refs.overlayTextfield.$el.style.left = leftPos + 'px'
        this.$refs.overlayTextfield.$el.style.top = entry.y + 2 + 'px'
        this.overlayInputEntry = this.undoableStore.getSegmentForId(entry.timeline, entry.id)
        this.overlayInputModel = this.overlayInputEntry.annotation
      })
    },

    draw() {
      const { ctx } = this
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const rescale = this.transform.rescaleX(this.scale)

      this.drawTimelines(rescale)
      this.drawTmpShot(rescale)

      this.drawAxis()
      this.drawPlayHead(rescale(this.tempStore.playPosition * this.mainStore.fps))
    },

    drawAxis() {
      const transScale = this.transform.rescaleX(this.scale)
      const tickSize = 13
      const YbelowText = 28
      const smallTickSize = Math.round(tickSize / 2.5)
      const smallTicks = transScale.ticks(Math.floor(this.canvasWidth / 13))
      const ticks = transScale.ticks(Math.floor(this.canvasWidth / 130))
      const tickFormat = (d) => {
        return this.mainStore.timeReadableSec(Math.round(d / this.mainStore.fps))
      }

      this.ctx.strokeStyle = this.axisColor
      this.ctx.lineWidth = '1'

      this.ctx.beginPath()
      ticks.forEach((d) => {
        this.ctx.moveTo(transScale(d), YbelowText)
        this.ctx.lineTo(transScale(d), YbelowText - tickSize)
      })

      smallTicks.forEach((d) => {
        this.ctx.moveTo(transScale(d), YbelowText)
        this.ctx.lineTo(transScale(d), YbelowText - smallTickSize)
      })
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.moveTo(0, YbelowText)
      this.ctx.lineTo(this.canvasWidth, YbelowText)
      this.ctx.stroke()

      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'top'
      this.ctx.fillStyle = this.axisColor
      ticks.forEach((d) => {
        this.ctx.beginPath()
        this.ctx.fillText(tickFormat(d), transScale(d), 0)
      })
    },

    drawPlayHead(xPosition) {
      const yPosition = 26
      this.ctx.beginPath()
      this.ctx.strokeStyle = 'red'
      this.ctx.lineWidth = '2'
      this.ctx.moveTo(xPosition, this.canvasHeight)
      this.ctx.lineTo(xPosition, yPosition)
      this.ctx.stroke()

      this.ctx.fillStyle = 'red'
      this.ctx.beginPath()
      this.ctx.moveTo(xPosition, yPosition)
      this.ctx.lineTo(xPosition + 8, yPosition - 5)
      this.ctx.lineTo(xPosition + 8, yPosition - 12)
      this.ctx.lineTo(xPosition - 8, yPosition - 12)
      this.ctx.lineTo(xPosition - 8, yPosition - 5)
      this.ctx.lineTo(xPosition, yPosition)
      this.ctx.closePath()
      this.ctx.fill()
    },

    drawSetup() {
      const data = []

      this.numTimelines = 0
      for (const timeline of this.undoableStore.timelines) {
        for (const [shotIndex, shot] of timeline.data.entries()) {
          if (timeline.type === 'shots') {
            let color = '#aaaaaa'
            if (shotIndex % 2 === 0) color = '#cccccc'
            if (shot.locked) color = '#eeeeee'
            const annotation = shotIndex + 1 + ': ' + (shot.annotation || '').slice(0, 40)
            data.push({
              annotation,
              fill: color,
              height: 44,
              id: shot.id,
              locked: shot.locked,
              selected: this.tempStore.selectedSegments.has(shot.id),
              timeline: timeline.id,
              type: 'shot',
              width: shot.end - shot.start,
              x: shot.start,
              y: this.numTimelines * TIMELINE_HEIGHT + AXES_HEIGHT
            })
          } else if (timeline.type.startsWith('screenshots')) {
            data.push({
              height: 44,
              id: shot.id,
              selected: this.tempStore.selectedSegments.has(shot.id),
              timeline: timeline.id,
              type: 'screenshot',
              uri: shot.thumbnail,
              width: 44 * (16 / 9),
              x: shot.frame,
              y: this.numTimelines * TIMELINE_HEIGHT + AXES_HEIGHT
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
        if (timeline.vocabulary && this.tempStore.timelinesFold[timeline.id].visible) {
          for (const category of this.tempStore.timelinesFold[timeline.id].categories) {
            this.numTimelines += 1
            if (category.visible) {
              for (const tag of category.tags) {
                this.numTimelines += 1
                //TODO: reduce nesting and complexity here
                /* eslint-disable max-depth */
                for (const [shotIndex, shot] of timeline.data.entries()) {
                  let color = '#aaaaaa'
                  if (shotIndex % 2 === 0) color = '#cccccc'
                  if (shot.vocabAnnotation.includes(tag.id)) color = '#aa5555'

                  data.push({
                    fill: color,
                    height: 44,
                    id: shot.id,
                    tag: tag.id,
                    timeline: timeline.id,
                    type: 'select',
                    width: shot.end - shot.start,
                    x: shot.start,
                    y: this.numTimelines * TIMELINE_HEIGHT + AXES_HEIGHT
                  })
                }
                /* eslint-enable max-depth */
              }
            }
          }
        }
        this.numTimelines += 1
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
      this.ctx.scale(this.dpr, this.dpr)

      // Picking: selection happens via a hidden canvas that has the same
      // elements with each in a different color
      const hCanvas = d3.select(this.$refs.hiddenCanvas)
      let colorI = 10
      this.hCtx = hCanvas.node().getContext('2d')
      this.hCtx.scale(this.dpr, this.dpr)
      for (const d of data) {
        d.hiddenColor = '#' + colorI.toString(16).padStart(6, '0')
        colorI += 20
        d.hiddenLeftHandle = '#' + colorI.toString(16).padStart(6, '0')
        colorI += 20
        d.hiddenRightHandle = '#' + colorI.toString(16).padStart(6, '0')
        colorI += 20
      }
      // Modify data first and then access property because property access is slow
      this.data = data

      this.resize()
    },

    drawTimelines(rescale) {
      if (this.data.length === 0) return
      const { hCtx, ctx, data } = this
      const imageCache = this.tempStore.imageCache
      hCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const selectedSegments = new Set(this.tempStore.selectedSegments.keys())
      ctx.textAlign = 'left'
      ctx.font = '15px Arial'
      ctx.textBaseline = 'top'

      for (const d of data) {
        const x = Math.round(rescale(d.x))
        const xwidth = Math.round(rescale(d.x + d.width))
        // eslint-disable-next-line no-continue
        if (xwidth < 0 || x > this.canvasWidth || xwidth - x <= 0) continue

        hCtx.fillStyle = d.hiddenColor
        if (d.type === 'shot') {
          ctx.fillStyle = selectedSegments.has(d.id) ? 'yellow' : d.fill
          ctx.fillRect(x, d.y, xwidth - x, d.height)
          if (xwidth - x > 20) {
            ctx.save()
            ctx.rect(x, d.y, xwidth - x, d.height)
            ctx.fillStyle = 'black'
            ctx.clip()
            ctx.fillText(d.annotation, x + 10, d.y + 15)
            ctx.restore()
          }
          hCtx.fillRect(x, d.y, xwidth - x, d.height)

          // Draw handles for grabbing
          ctx.globalAlpha = 0.1
          ctx.fillStyle = 'black'
          const resizeWidth = Math.round(rescale(d.x + Math.min(d.width * 0.2, 20)) - x)
          ctx.fillRect(x, d.y, resizeWidth, 20)
          ctx.fillRect(xwidth - resizeWidth, d.y, resizeWidth, 20)
          ctx.globalAlpha = 1.0

          hCtx.fillStyle = d.hiddenLeftHandle
          hCtx.fillRect(x, d.y, resizeWidth, 20)
          hCtx.fillStyle = d.hiddenRightHandle
          hCtx.fillRect(xwidth - resizeWidth, d.y, resizeWidth, 20)
        } else if (d.type === 'select') {
          ctx.fillStyle = d.fill
          ctx.fillRect(x, d.y, xwidth - x, d.height)
          hCtx.fillRect(x, d.y, xwidth - x, d.height)
        } else if (d.type === 'screenshot') {
          const image = imageCache.get(d.uri)
          // eslint-disable-next-line no-continue
          if (!image) continue
          if (selectedSegments.has(d.id)) {
            ctx.fillStyle = 'yellow'
            ctx.fillRect(x, d.y, d.width, d.height)
            ctx.globalAlpha = 0.5
          }
          ctx.drawImage(image, x, d.y, d.width, d.height)
          ctx.globalAlpha = 1.0
          hCtx.fillRect(x, d.y, d.width, d.height)
        }
      }
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

    getTimelineForCoordinate(y) {
      let index = 0
      let offset = AXES_HEIGHT

      for (const timeline of this.undoableStore.timelines) {
        offset += TIMELINE_HEIGHT
        if (offset > y) break

        const fold = this.tempStore.timelinesFold[timeline.id]
        if (fold.visible) {
          for (const category of fold.categories) {
            offset += TIMELINE_HEIGHT
            if (offset > y) break
            if (category.visible) {
              offset += category.tags.length * TIMELINE_HEIGHT
            }
          }
        }
        index += 1
      }

      return index
    },

    mousedown(e) {
      this.tempStore.tmpShot = null
      if (e.altKey || e.shiftKey) e.stopImmediatePropagation()
      const rect = this.$refs.canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * this.dpr
      const y = (e.clientY - rect.top) * this.dpr
      const coordX = e.clientX - rect.left
      const coordY = e.clientY - rect.top

      // New timeline segment
      if (e.altKey) {
        if (coordY < 40) return

        const nTimeline = this.getTimelineForCoordinate(coordY)
        if (this.undoableStore.timelines[nTimeline].type !== 'shots') return

        const height = coordY - ((coordY - AXES_HEIGHT) % TIMELINE_HEIGHT)
        const start = this.transform.rescaleX(this.scale).invert(coordX)
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
      const colorData = this.hCtx.getImageData(x, y, 1, 1).data
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
        start: entry.x,
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

      const rect = this.$refs.canvas.getBoundingClientRect()
      const coordX = e.clientX - rect.left
      const xNew = Math.round(this.transform.rescaleX(this.scale).invert(coordX))

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
          this.getTimelineForCoordinate(coord[1]),
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
      this.overlayInput = false
    },

    overlayInputChange() {
      this.overlayInputEntry.annotation = this.overlayInputModel
      this.overlayInput = false
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
      // Get the display size of the canvas
      const container = this.$refs.canvas.parentElement
      const displayWidth = container.clientWidth
      const displayHeight = this.numTimelines * TIMELINE_HEIGHT + AXES_HEIGHT

      // Set the canvas display size
      this.canvasWidth = displayWidth
      this.canvasHeight = displayHeight

      // Set the canvas internal (buffer) size
      this.$refs.canvas.width = Math.floor(displayWidth * this.dpr)
      this.$refs.canvas.height = Math.floor(displayHeight * this.dpr)
      this.$refs.canvas.style.width = '100%'
      this.$refs.canvas.style.height = `${displayHeight}px`

      // Same for hidden canvas
      this.$refs.hiddenCanvas.width = Math.floor(displayWidth * this.dpr)
      this.$refs.hiddenCanvas.height = Math.floor(displayHeight * this.dpr)

      // Scale the context
      this.ctx.scale(this.dpr, this.dpr)
      this.hCtx.scale(this.dpr, this.dpr)

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
