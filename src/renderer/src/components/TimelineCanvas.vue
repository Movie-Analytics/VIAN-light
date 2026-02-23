<template>
  <div class="position-relative w-100">
    <teleport defer to="#timelineAxesContainer">
      <canvas ref="timeCanvas" class="float-right" />
    </teleport>

    <canvas ref="canvas" height="0"></canvas>

    <v-overlay v-model="overlayInput" contained>
      <v-textarea
        ref="overlayTextfield"
        v-model="overlayInputModel"
        auto-grow
        rows="1"
        max-rows="3"
        label="Annotations"
        min-width="200"
        hide-details="true"
        variant="solo"
        density="compact"
        class="bg-blue-grey-lighten-5 position-absolute"
        @change="overlayInputChange"
        @keydown.enter.prevent="overlayInputChange"
      ></v-textarea>
    </v-overlay>

    <canvas ref="hiddenCanvas" height="0" class="d-none"></canvas>
  </div>
</template>

<script>
import * as d3 from 'd3'
import { mapStores } from 'pinia'
import { markRaw } from 'vue'

import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

const TIMELINE_HEIGHT = 49
const PLAYHEAD_COLOR = '#ff0000'

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
      tCtx: null,
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
    const panningHandler = (e) => {
      this.zoom.translateBy(d3.select(e.currentTarget), e.wheelDeltaX / this.transform.k, 0)
      this.requestDraw()
    }
    d3.select(this.$refs.canvas).on('wheel', panningHandler)
    d3.select(this.$refs.timeCanvas).on('wheel', panningHandler)
    d3.select(this.$refs.timeCanvas).on('click', this.timeAxisClickHandler)

    const drag = d3
      .drag()
      .filter((e) => {
        const [x, y] = d3.pointer(e, this.$refs.timeCanvas)
        const xdpr = Math.floor(x * this.dpr)
        const ydpr = Math.floor(y * this.dpr)
        const pixel = this.tCtx.getImageData(xdpr, ydpr, 1, 1).data
        const color = this.rgbToHex(pixel[0], pixel[1], pixel[2])
        return color === PLAYHEAD_COLOR
      })
      .on('drag', this.timeAxisDrag)
    d3.select(this.$refs.timeCanvas).call(drag)

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

      if (entries.length > 0) {
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
        this.$refs.overlayTextfield.focus()
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

      const tCtx = this.tCtx
      tCtx.clearRect(0, 0, this.canvasWidth, 50)

      tCtx.strokeStyle = this.axisColor
      tCtx.lineWidth = '1'

      tCtx.beginPath()
      ticks.forEach((d) => {
        tCtx.moveTo(transScale(d), YbelowText)
        tCtx.lineTo(transScale(d), YbelowText - tickSize)
      })

      smallTicks.forEach((d) => {
        tCtx.moveTo(transScale(d), YbelowText)
        tCtx.lineTo(transScale(d), YbelowText - smallTickSize)
      })
      tCtx.stroke()

      tCtx.beginPath()
      tCtx.moveTo(0, YbelowText)
      tCtx.lineTo(this.canvasWidth, YbelowText)
      tCtx.stroke()

      tCtx.textAlign = 'center'
      tCtx.textBaseline = 'top'
      tCtx.fillStyle = this.axisColor
      ticks.forEach((d) => {
        tCtx.beginPath()
        tCtx.fillText(tickFormat(d), transScale(d), 0)
      })
    },

    drawPlayHead(xPosition) {
      const yPosition = 26
      this.ctx.beginPath()
      this.ctx.strokeStyle = PLAYHEAD_COLOR
      this.ctx.lineWidth = '2'
      this.ctx.moveTo(xPosition, this.canvasHeight)
      this.ctx.lineTo(xPosition, 0)
      this.ctx.stroke()

      this.tCtx.fillStyle = PLAYHEAD_COLOR
      this.tCtx.beginPath()
      this.tCtx.moveTo(xPosition, yPosition)
      this.tCtx.lineTo(xPosition + 8, yPosition - 5)
      this.tCtx.lineTo(xPosition + 8, yPosition - 12)
      this.tCtx.lineTo(xPosition - 8, yPosition - 12)
      this.tCtx.lineTo(xPosition - 8, yPosition - 5)
      this.tCtx.lineTo(xPosition, yPosition)
      this.tCtx.closePath()
      this.tCtx.fill()
      this.tCtx.beginPath()
      this.tCtx.strokeStyle = PLAYHEAD_COLOR
      this.tCtx.lineWidth = '2'
      this.tCtx.moveTo(xPosition, 26)
      this.tCtx.lineTo(xPosition, 32)
      this.tCtx.stroke()
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
              width: shot.end - shot.start + 1,
              x: shot.start,
              y: this.numTimelines * TIMELINE_HEIGHT
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
              y: this.numTimelines * TIMELINE_HEIGHT
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
        if (timeline.type === 'scalar') {
          data.push({
            data: timeline.data.map(
              (t) => (this.numTimelines + 1) * TIMELINE_HEIGHT - t * (TIMELINE_HEIGHT - 5) - 5
            ),
            fps: timeline.fps,
            height: 44,
            id: timeline.id,
            timeline: timeline.id,
            type: 'scalar'
          })
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
                    width: shot.end - shot.start + 1,
                    x: shot.start,
                    y: this.numTimelines * TIMELINE_HEIGHT
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
        .wheelDelta((event) => {
          let factor = event.deltaMode === 1 ? 0.05 : 0.01
          if (Math.abs(event.deltaY) > 25) {
            // Mouse scrolling has delta > 200 and touchpad around 20 so limit delta here
            factor *= 25 / Math.abs(event.deltaY)
          }
          return -event.deltaY * factor
        })
        .scaleExtent([1, this.mainStore.videoDuration * 0.15])
        .filter((e) => {
          if (e.ctrlKey) e.preventDefault()
          // Only allow zoom via pinch on touchpad and ctrl+zoom with mouse
          if (e.type === 'wheel') return e.ctrlKey
          return true
        })
        .on('zoom', (event) => {
          this.transform = event.transform

          // Synchronise transform state between the two canvases
          if (event.sourceEvent) {
            if (event.sourceEvent.target === this.$refs.canvas) {
              d3.select(this.$refs.timeCanvas).property('__zoom', event.transform)
            } else {
              d3.select(this.$refs.canvas).property('__zoom', event.transform)
            }
          }

          this.requestDraw()
        })

      const canvas = d3.select(this.$refs.canvas).call(this.zoom)
      this.ctx = canvas.node().getContext('2d')
      this.ctx.scale(this.dpr, this.dpr)

      this.tCtx = d3.select(this.$refs.timeCanvas).call(this.zoom).node().getContext('2d')
      this.tCtx.scale(this.dpr, this.dpr)

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
      this.data = markRaw(data)

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
        if (xwidth < 0 || x > this.canvasWidth || (xwidth - x <= 0 && d.type !== 'screenshot'))
          // eslint-disable-next-line no-continue
          continue

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
        } else if (d.type === 'scalar') {
          ctx.beginPath()
          ctx.lineWidth = '1'
          ctx.strokeStyle = 'DimGray'
          ctx.moveTo(rescale(0), d.data[0])
          const mainFps = this.mainStore.fps
          d.data.forEach((p, i) => {
            ctx.lineTo(rescale((i / d.fps) * mainFps), p)
          })
          ctx.stroke()
        }
      }
    },

    drawTmpShot(rescale) {
      if (this.tempStore.tmpShot === null) return
      this.ctx.fillStyle = 'yellow'
      this.ctx.fillRect(
        rescale(this.tempStore.tmpShot.start),
        this.tempStore.tmpShot.y,
        rescale(this.tempStore.tmpShot.end + 1) - rescale(this.tempStore.tmpShot.start),
        this.tempStore.tmpShot.height
      )

      if (this.tempStore.adjacentShot === null) return
      this.ctx.fillStyle = 'orange'
      this.ctx.fillRect(
        rescale(this.tempStore.adjacentShot.start),
        this.tempStore.adjacentShot.y,
        rescale(this.tempStore.adjacentShot.end + 1) - rescale(this.tempStore.adjacentShot.start),
        this.tempStore.adjacentShot.height
      )
    },

    getTimelineForCoordinate(y) {
      let index = 0
      let offset = 0

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
        const nTimeline = this.getTimelineForCoordinate(coordY)
        if (this.undoableStore.timelines[nTimeline].type !== 'shots') return

        const height = coordY - (coordY % TIMELINE_HEIGHT)
        const start = this.transform.rescaleX(this.scale).invert(coordX)
        this.tempStore.tmpShot = {
          end: start,
          height: 44,
          max: this.mainStore.numFrames,
          min: 0,
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
        end: entry.x + entry.width - 1,
        height: 44,
        max: this.mainStore.numFrames,
        min: 0,
        origin: entry.hiddenLeftHandle === color ? entry.x + entry.width - 1 : entry.x,
        originalShot: entry,
        start: entry.x,
        y: entry.y
      }
      const currentIndex = this.data.indexOf(entry)
      const leftSide = entry.hiddenLeftHandle === color
      const adjacent = leftSide ? this.data[currentIndex - 1] : this.data[currentIndex + 1]

      if (adjacent?.timeline === entry.timeline) {
        // Prevent overlapping segments
        this.tempStore.tmpShot.min = leftSide
          ? adjacent.x + adjacent.width
          : this.tempStore.tmpShot.start
        this.tempStore.tmpShot.max = leftSide ? this.tempStore.tmpShot.end : adjacent.x - 1

        if (e.shiftKey && adjacent.locked) {
          this.tempStore.tmpShot = null
        } else if (e.shiftKey) {
          this.tempStore.adjacentShot = {
            diff: leftSide
              ? entry.x - (adjacent.x + adjacent.width - 1)
              : adjacent.x - (entry.x + entry.width - 1),

            end: adjacent.x + adjacent.width - 1,
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
      const rect = this.$refs.canvas.getBoundingClientRect()
      const coordX = e.clientX - rect.left
      const xNew = Math.round(this.transform.rescaleX(this.scale).invert(coordX))

      if (e.buttons !== 1 || this.tempStore.tmpShot === null) return
      if (e.altKey || e.shiftKey) e.stopImmediatePropagation()

      // Limit the bounds so that no overlapping or inverted segments (end before start) get created
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
      const { tmpShot, adjacentShot } = { ...this.tempStore }
      if (e.shiftKey && adjacentShot) {
        if (adjacentShot.leftSide) {
          tmpShot.start = clamp(xNew, adjacentShot.start + adjacentShot.diff + 1, tmpShot.origin)
          tmpShot.end = clamp(xNew, tmpShot.end, tmpShot.origin + 1)
          adjacentShot.end = tmpShot.start - adjacentShot.diff
        } else {
          tmpShot.start = clamp(xNew, tmpShot.start, tmpShot.origin - 1)
          tmpShot.end = clamp(xNew, tmpShot.origin + 1, adjacentShot.end - adjacentShot.diff - 1)
          adjacentShot.start = tmpShot.end + adjacentShot.diff
        }
      } else {
        tmpShot.start = clamp(xNew, tmpShot.min, tmpShot.origin)
        tmpShot.end = clamp(xNew, tmpShot.origin, tmpShot.max)
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
      const displayHeight = this.numTimelines * TIMELINE_HEIGHT

      // Set the canvas display size
      this.canvasWidth = displayWidth
      this.canvasHeight = displayHeight

      // Set the canvas internal (buffer) size
      this.$refs.canvas.width = Math.floor(displayWidth * this.dpr)
      this.$refs.canvas.height = Math.floor(displayHeight * this.dpr)
      this.$refs.canvas.style.width = '100%'
      this.$refs.canvas.style.height = `${displayHeight}px`

      const parent = document.getElementById('timelineSplitter')
      this.$refs.timeCanvas.style.marginRight = parent.offsetWidth - parent.clientWidth + 'px'

      this.$refs.timeCanvas.width = Math.floor(displayWidth * this.dpr)
      this.$refs.timeCanvas.height = 32 * this.dpr
      this.$refs.timeCanvas.style.width = getComputedStyle(this.$refs.canvas).width

      // Same for hidden canvas
      this.$refs.hiddenCanvas.width = Math.floor(displayWidth * this.dpr)
      this.$refs.hiddenCanvas.height = Math.floor(displayHeight * this.dpr)

      // Scale the context
      this.ctx.scale(this.dpr, this.dpr)
      this.hCtx.scale(this.dpr, this.dpr)
      this.tCtx.scale(this.dpr, this.dpr)

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
    },

    timeAxisClickHandler(e) {
      const coordX = e.clientX - this.$refs.timeCanvas.getBoundingClientRect().left
      const timePosition = this.transform.rescaleX(this.scale).invert(coordX) / this.mainStore.fps
      this.tempStore.playJumpPosition = timePosition
    },

    timeAxisDrag(e) {
      const x = d3.pointer(e, this.$refs.timeCanvas)[0]
      const timePosition = this.transform.rescaleX(this.scale).invert(x) / this.mainStore.fps
      this.tempStore.playJumpPosition = timePosition
    }
  }
}
</script>

<style scoped>
canvas {
  width: 100%;
}
</style>
