import { defineStore } from 'pinia'
import { useUndoStore } from './undo'
import { useMainStore } from './main'
import { api } from '@renderer/api'

export const useUndoableStore = defineStore('undoable', {
  state: () => ({
    subtitles: null,
    timelines: [],
    subtitlesVisible: true,
    id: null
  }),
  getters: {
    subtitleFileSrc() {
      if (this.subtitles === null) return undefined
      return 'app://' + this.subtitles
    },
    shotTimelines() {
      return this.timelines.filter((t) => t.type === 'shots')
    },
    screenshotTimelines() {
      return this.timelines.filter((t) => t.type.startsWith('screenshot'))
    }
  },
  actions: {
    async initialize() {
      this.$subscribe((mutation, state) => {
        if (state.id === null || mutation.events.key === 'id') return
        const copyState = JSON.parse(JSON.stringify(state))
        api().saveStore('undoable', copyState)

        const undoStore = useUndoStore()
        undoStore.push('undoable', copyState)
      })

      // set up listeners
      api().onScreenshotsGeneration((channel, data) => {
        for (const screenshot of data) {
          screenshot.id = crypto.randomUUID()
        }
        this.timelines.push({
          type: 'screenshots',
          name: 'Screenshots',
          id: crypto.randomUUID(),
          data: data
        })
      })
      api().onScreenshotGeneration((channel, data) => {
        data.id = crypto.randomUUID()
        if (this.timelines.filter((t) => t.type === 'screenshots-manual').length > 0) {
          this.timelines.filter((t) => t.type === 'screenshots-manual')[0].data.push(data)
        } else {
          this.timelines.push({
            type: 'screenshots-manual',
            name: 'Manual Screenshots',
            id: crypto.randomUUID(),
            data: [data]
          })
        }
      })
      api().onShotBoundaryDetection((channel, data) => {
        this.timelines.push({
          type: 'shots',
          name: 'Shots',
          id: crypto.randomUUID(),
          data: data.map((shot) => ({ start: shot[0], end: shot[1], id: crypto.randomUUID() }))
        })
      })
    },
    async runShotBoundaryDetection() {
      const mainStore = useMainStore()
      api().runShotBoundaryDetection(mainStore.video)
    },
    async loadSubtitles() {
      this.subtitles = await api().loadSubtitles(this.id)
      return this.subtitles
    },
    deleteSegments(timelineId, segmentIds) {
      const timeline = this.timelines.filter((t) => t.id === timelineId)[0]
      timeline.data = timeline.data.filter((s) => segmentIds.indexOf(s.id) < 0)
      const tempStore = useTempStore()
      tempStore.validateSelectedSegments()
    },
    mergeSegments(timelineId, segmentIds) {
      const timeline = this.timelines.filter((t) => t.id === timelineId)[0]
      const segment = timeline.data.filter((s) => s.id == segmentIds[0])[0]
      for (const segmentId of segmentIds.slice(1)) {
        const index = timeline.data.map((s) => s.id).indexOf(segmentId)
        segment.start = Math.min(segment.start, timeline.data[index].start)
        segment.end = Math.max(segment.end, timeline.data[index].end)
        timeline.data.splice(index, 1)
      }
      const tempStore = useTempStore()
      tempStore.validateSelectedSegments()
    },
    getSegmentForId(timelineId, segmentId) {
      const timeline = this.timelines.filter((t) => t.id === timelineId)[0]
      return timeline.data.filter((s) => s.id == segmentId)[0]
    },
    splitSegment(timelineId, segmentId, position) {
      const timeline = this.timelines.filter((t) => t.id === timelineId)[0]
      const index = timeline.data.map((s) => s.id).indexOf(segmentId)
      const segment = timeline.data[index]
      timeline.data.splice(index + 1, 0, {
        start: position,
        end: segment.end,
        id: crypto.randomUUID()
      })
      segment.end = position - 1
    },
    addShotToNth(n, start, end) {
      const data = this.timelines[n].data.slice()
      data.push({
        start: Math.round(start),
        end: Math.round(end),
        id: crypto.randomUUID()
      })
      data.sort((a, b) => a.start - b.start)
      this.timelines[n].data = data
    },
    changeShotBoundaries(shotId, start, end) {
      for (const timeline of this.timelines) {
        if (timeline.type !== 'shots') continue
        for (const shot of timeline.data) {
          if (shot.id === shotId) {
            shot.start = start
            shot.end = end
            return
          }
        }
      }
    },
    generateScreenshots(frames) {
      const mainStore = useMainStore()
      api().runScreenshotsGeneration(mainStore.video, frames, this.id)
    },
    generateScreenshot(frame) {
      const mainStore = useMainStore()
      api().runScreenshotGeneration(mainStore.video, frame, this.id)
    },
    deleteTimeline(id) {
      this.timelines = this.timelines.filter((t) => t.id !== id)
      const tempStore = useTempStore()
      tempStore.validateSelectedSegments()
    },
    duplicateTimeline(id) {
      const timeline = this.timelines.filter((t) => t.id === id)[0]
      const newTimeline = JSON.parse(JSON.stringify(timeline))
      newTimeline.data.forEach((d) => {
        d.id = crypto.randomUUID()
      })
      newTimeline.id = crypto.randomUUID()
      newTimeline.name += ' (copy)'
      this.timelines.push(newTimeline)
    },
    renameTimeline(id, name) {
      this.timelines.filter((t) => t.id === id)[0].name = name
    },
    addNewTimeline() {
      this.timelines.push({
        type: 'shots',
        name: 'Shots',
        id: crypto.randomUUID(),
        data: []
      })
    },
    async importAnnotations() {
      const timelines = await api().importAnnotations(this.id)
      if (!timelines) return
      this.timelines = this.timelines.concat(timelines)
    },

    async loadStore(projectId) {
      const state = await api().loadStore('undoable', projectId)
      if (state !== undefined) {
        this.$patch(state)
      } else {
        this.id = projectId
      }
    },
    undo() {
      const undoStore = useUndoStore()
      this.$patch(undoStore.undo('undoable'))
    },
    redo() {
      const undoStore = useUndoStore()
      this.$patch(undoStore.redo('undoable'))
    },
    reset() {
      this.id = null
      this.subtitles = null
      this.timelines = []
      this.subtitlesVisible = true
    }
  }
})
