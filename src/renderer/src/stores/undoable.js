import { defineStore } from 'pinia'

import { useUndoStore } from './undo'
import { useMainStore } from './main'
import { useTempStore } from './temp'
import api from '@renderer/api'
import { parseEafAnnotations } from '@renderer/importexport'

export const useUndoableStore = defineStore('undoable', {
  state: () => ({
    subtitles: null,
    timelines: [],
    subtitlesVisible: true,
    id: null
  }),
  getters: {
    shotTimelines: (state) => state.timelines.filter((t) => t.type === 'shots'),
    screenshotTimelines: (state) => state.timelines.filter((t) => t.type.startsWith('screenshot'))
  },
  actions: {
    async initialize() {
      this.$subscribe((mutation, state) => {
        if (state.id === null || mutation.events.key === 'id') return
        const copyState = JSON.parse(JSON.stringify(state))
        api.saveStore('undoable', copyState)

        useUndoStore().push('undoable', copyState)
      })

      api.onScreenshotsGeneration(this.onScreenshotsGeneration)
      api.onScreenshotGeneration(this.onScreenshotGeneration)
      api.onShotBoundaryDetection(this.onShotBoundaryDetection)
    },
    onShotBoundaryDetection(data) {
      this.timelines.push({
        type: 'shots',
        name: 'Shots',
        id: crypto.randomUUID(),
        data: data.map((shot) => ({ start: shot[0], end: shot[1], id: crypto.randomUUID() }))
      })
    },
    onScreenshotGeneration(data) {
      data.id = crypto.randomUUID()
      if (this.timelines.find((t) => t.type === 'screenshots-manual')) {
        this.timelines.find((t) => t.type === 'screenshots-manual').data.push(data)
      } else {
        this.timelines.push({
          type: 'screenshots-manual',
          name: 'Manual Screenshots',
          id: crypto.randomUUID(),
          data: [data]
        })
      }
    },
    onScreenshotsGeneration(data) {
      data.forEach((screenshot) => {
        screenshot.id = crypto.randomUUID()
      })
      this.timelines.push({
        type: 'screenshots',
        name: 'Screenshots',
        id: crypto.randomUUID(),
        data: data
      })
    },
    async runShotBoundaryDetection() {
      api.runShotBoundaryDetection(useMainStore().video)
    },
    async loadSubtitles() {
      this.subtitles = await api.loadSubtitles(this.id)
      return this.subtitles
    },
    getTimelineById(id) {
      return this.timelines.find((t) => t.id === id)
    },
    deleteSegments(timelineId, segmentIds) {
      const timeline = this.getTimelineById(timelineId)
      timeline.data = timeline.data.filter((s) => !segmentIds.includes(s.id))
      useTempStore().validateSelectedSegments()
    },
    mergeSegments(timelineId, segmentIds) {
      const timeline = this.getTimelineById(timelineId)
      const segment = timeline.data.find((s) => s.id == segmentIds[0])
      segmentIds.slice(1).forEach((segmentId) => {
        const index = timeline.data.findIndex((s) => s.id === segmentId)
        segment.start = Math.min(segment.start, timeline.data[index].start)
        segment.end = Math.max(segment.end, timeline.data[index].end)
        timeline.data.splice(index, 1)
      })
      useTempStore().validateSelectedSegments()
    },
    getSegmentForId(timelineId, segmentId) {
      const timeline = this.getTimelineById(timelineId)
      return timeline.data.find((s) => s.id === segmentId)
    },
    splitSegment(timelineId, segmentId, position) {
      const timeline = this.getTimelineById(timelineId)
      const index = timeline.data.findIndex((s) => s.id === segmentId)
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
        const shot = timeline.data.find((s) => s.id === shotId)
        if (shot) {
          shot.start = start
          shot.end = end
          return
        }
      }
    },
    generateScreenshots(frames) {
      api.runScreenshotsGeneration(useMainStore().video, frames, this.id)
    },
    generateScreenshot(frame) {
      api.runScreenshotGeneration(useMainStore().video, frame, this.id)
    },
    deleteTimeline(id) {
      this.timelines = this.timelines.filter((t) => t.id !== id)
      useTempStore().validateSelectedSegments()
    },
    duplicateTimeline(id) {
      const timeline = this.getTimelineById(id)
      const newTimeline = JSON.parse(JSON.stringify(timeline))
      newTimeline.data.forEach((d) => {
        d.id = crypto.randomUUID()
      })
      newTimeline.id = crypto.randomUUID()
      newTimeline.name += ' (copy)'
      this.timelines.push(newTimeline)
    },
    renameTimeline(id, name) {
      this.getTimelineById(id).name = name
    },
    addNewTimeline() {
      this.timelines.push({
        type: 'shots',
        name: 'Shots',
        id: crypto.randomUUID(),
        data: []
      })
    },
    importAnnotations() {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = '.eaf'
      fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = async (e) => {
          const content = e.target.result
          this.timelines = this.timelines.concat(parseEafAnnotations(content))
        }
        reader.readAsText(file)
      })
      fileInput.click()
    },
    async loadStore(projectId) {
      const state = await api.loadStore('undoable', projectId)
      if (state !== null) {
        this.$patch(state)
      } else {
        this.id = projectId
      }
    },
    undo() {
      this.$patch(useUndoStore().undo('undoable'))
    },
    redo() {
      this.$patch(useUndoStore().redo('undoable'))
    }
  }
})
