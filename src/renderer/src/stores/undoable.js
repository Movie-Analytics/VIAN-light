import { defineStore } from 'pinia'
import { useUndoStore } from './undo'
import { useMainStore } from './main'

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
    }
  },
  actions: {
    async initialize() {
      this.$subscribe((mutation, state) => {
        if (state.id === null) return
        const copyState = JSON.parse(JSON.stringify(state))
        window.electronAPI.saveStore('undoable', copyState)

        if (mutation.events.key === 'id') return
        const undoStore = useUndoStore()
        undoStore.push('undoable', copyState)
      })
    },
    async runShotBoundaryDetection() {
      const mainStore = useMainStore()
      window.electronAPI.runShotBoundaryDetection(mainStore.video)
      window.electronAPI.onShotBoundaryDetection((channel, data) => {
        this.timelines.push({
          type: 'shots',
          name: 'Shots',
          id: crypto.randomUUID(),
          data: data.map((shot) => ({ start: shot[0], end: shot[1], id: crypto.randomUUID() }))
        })
      })
    },
    async loadSubtitles() {
      this.subtitles = await window.electronAPI.loadSubtitles()
      return this.subtitles
    },
    deleteSegments(timelineId, segmentIds) {
      const timeline = this.timelines.filter((t) => t.id === timelineId)[0]
      timeline.data = timeline.data.filter((s) => segmentIds.indexOf(s.id) < 0)
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
    },
    splitSegment(timelineId, segmentId, position) {
      const timeline = this.timelines.filter((t) => t.id === timelineId)[0]
      const index = timeline.data.map((s) => s.id).indexOf(segmentId)
      const segment = timeline.data[index]
      timeline.data.splice(index+1, 0, {
        start: position,
        end: segment.end,
        id: crypto.randomUUID()
      })
      segment.end = position - 1
    },
    deleteTimeline(id) {
      this.timelines = this.timelines.filter((t) => t.id !== id)
    },
    duplicateTimeline(id) {
      const timeline = this.timelines.filter((t) => t.id === id)[0]
      const newTimeline = JSON.parse(JSON.stringify(timeline))
      newTimeline.id = crypto.randomUUID()
      newTimeline.name += ' (copy)'
      this.timelines.push(newTimeline)
    },
    renameTimeline(id, name) {
      this.timelines.filter((t) => t.id === id)[0].name = name
    },

    async loadStore(projectId) {
      const state = await window.electronAPI.loadStore('undoable', projectId)
      if (state !== undefined) {
        this.$patch(state)
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
