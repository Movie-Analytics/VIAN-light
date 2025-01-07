<template>
  <div>
    <canvas ref="canvas" height="0"></canvas>
    <canvas ref="hiddenCanvas" height="0" style="display: none"></canvas>
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
    ...mapStores(useMainStore),
    ...mapStores(useTempStore),
    ...mapStores(useUndoableStore)
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
        this.draw()
      }
    },
    'mainStore.fps'() {
      if (this.mainStore.videoDuration && this.mainStore.fps) {
        this.drawSetup()
        this.draw()
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
        [-0.1, 0],
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
              selected: false,
              type: 'shot'
            })
          } else if (timeline.type === 'screenshots') {
            this.data.push({
              x: shot.frame,
              y: timeline_i * 48 + 30 + 2,
              width: 44 * (16 / 9),
              height: 44,
              timeline: timeline.id,
              id: shot.id,
              selected: false,
              type: 'screenshot',
              uri: shot.thumbnail
            })
            // only re-draw after 200 new images were loaded
            this.unloadedImages++
            d3.image(shot.thumbnail).then((img) => {
              this.tempStore.imageCache.set(shot.thumbnail, img)
              this.unloadedImages--
              if (this.unloadedImages % 200 == 0) this.draw()
            })
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
        const color = '#' + colorI.toString(16).padStart(6, '0')
        d.hiddenColor = color
        colorI = colorI + 20
      })

      this.resize()
    },
    clickHandler(event) {
      const coord = d3.pointer(event, this.$refs.canvas)
      const colorData = this.hCtx.getImageData(coord[0], coord[1], 1, 1).data
      const color = this.rgbToHex(colorData[0], colorData[1], colorData[2])
      const entries = this.data.filter((d) => d.hiddenColor == color)

      if (entries.length == 0) {
        // no element was clicked -> set player position
        // TODO
        console.log('Miss')
        return
      }
      const entry = entries[0]
      if (
        this.tempStore.selectedSegments.length > 0 &&
        this.tempStore.selectedSegments[0].timeline !== entry.timeline
      ) {
        // only allow selection from the same timeline
        entry.selected = true
        this.tempStore.selectedSegments.map((s) => (s.selected = false))
        this.tempStore.selectedSegments = [entry]
      } else if (entry.selected) {
        // click on selected element de-selects it
        entry.selected = false
        this.tempStore.selectedSegments = this.tempStore.selectedSegments.filter(
          (s) => s.id !== entry.id
        )
      } else {
        entry.selected = true
        this.tempStore.selectedSegments.push(entry)
      }
      this.draw()
    },
    drawAxis() {
      const transScale = this.transform.rescaleX(this.scale)
      const tickSize = 6
      const Y = 4
      const textMargin = 3
      const ticks = transScale.ticks(6)
      const tickFormat = (d) => {
        const sec = Math.round(d / this.mainStore.fps)
        const hours = String(Math.floor(sec / 3600)).padStart(2, '0')
        const minutes = String(Math.floor((sec - hours * 3600) / 60)).padStart(2, '0')
        const seconds = String(sec - minutes * 60).padStart(2, '0')
        return `${hours}:${minutes}:${seconds}`
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
      this.elements.each((d) => {
        if (d.type === 'shot') {
          this.ctx.fillStyle = d.fill
          if (d.selected) this.ctx.fillStyle = 'yellow'
          this.ctx.fillRect(rescale(d.x), d.y, rescale(d.x + d.width) - rescale(d.x), d.height)
        } else if (d.type === 'screenshot' && this.tempStore.imageCache.has(d.uri)) {
          if (d.selected) {
            this.ctx.fillStyle = 'yellow'
            this.ctx.fillRect(rescale(d.x), d.y, d.width, d.height)
            this.ctx.globalAlpha = 0.5
          }
          this.ctx.drawImage(
            this.tempStore.imageCache.get(d.uri),
            rescale(d.x),
            d.y,
            d.width,
            d.height
          )
          this.ctx.globalAlpha = 1.0
        }
      })

      // draw hidden canvas
      this.hCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      this.elements.each((d) => {
        this.hCtx.fillStyle = d.hiddenColor
        if (d.type === 'shot') {
          this.hCtx.fillRect(rescale(d.x), d.y, rescale(d.x + d.width) - rescale(d.x), d.height)
        } else if (d.type === 'screenshot' && this.tempStore.imageCache.has(d.uri)) {
          this.hCtx.fillRect(rescale(d.x), d.y, d.width, d.height)
        }
      })
    },
    draw() {
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      const rescale = this.transform.rescaleX(this.scale)

      this.drawTimelines(rescale)

      // draw current play position
      this.ctx.beginPath()
      this.ctx.strokeStyle = 'red'
      this.ctx.lineWidth = '2'
      const playPosition = rescale(Math.floor(this.tempStore.playPosition * this.mainStore.fps))
      this.ctx.moveTo(playPosition, 0)
      this.ctx.lineTo(playPosition, this.canvasHeight)
      this.ctx.stroke()

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
