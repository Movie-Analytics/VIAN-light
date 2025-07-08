import { defineStore } from 'pinia'

import api from '@renderer/api'
import { parseEafAnnotations } from '@renderer/importexport'
import { useMainStore } from './main'
import { useTempStore } from './temp'
import { useUndoStore } from './undo'

export const useUndoableStore = defineStore('undoable', {
  state: () => ({
    id: null,
    subtitles: null,
    subtitlesVisible: true,
    timelines: [],
    vocabularies: []
  }),
  /* eslint-disable-next-line vue/sort-keys */
  getters: {
    screenshotTimelines: (state) => state.timelines.filter((t) => t.type.startsWith('screenshot')),
    shotTimelines: (state) => state.timelines.filter((t) => t.type === 'shots')
  },
  /* eslint-disable-next-line vue/sort-keys */
  actions: {
    addNewTimeline() {
      this.timelines.push({
        data: [],
        id: crypto.randomUUID(),
        name: 'New Track ' + this.timelines.length,
        type: 'shots'
      })
    },
    addShotToNth(n, start, end) {
      const data = this.timelines[n].data.slice()
      data.push({
        end: Math.round(end),
        id: crypto.randomUUID(),
        start: Math.round(start)
      })
      data.sort((a, b) => a.start - b.start)
      this.timelines[n].data = data
    },
    addVocabulary(name) {
      const id = crypto.randomUUID()
      this.vocabularies.push({
        id,
        name,
        tags: []
      })
      return id
    },
    addVocabularyTag(vocabId, name) {
      const id = crypto.randomUUID()
      this.vocabularies
        .find((v) => v.id === vocabId)
        .tags.push({
          id,
          name
        })
      return id
    },
    changeShotBoundaries(shotId, start, end) {
      for (const timeline of this.timelines) {
        if (timeline.type === 'shots') {
          const shot = timeline.data.find((s) => s.id === shotId)
          if (shot) {
            shot.start = start
            shot.end = end
            return
          }
        }
      }
    },
    deleteSegments(timelineId, segmentIds) {
      const timeline = this.getTimelineById(timelineId)
      timeline.data = timeline.data.filter((s) => !segmentIds.includes(s.id))
      useTempStore().validateSelectedSegments()
    },
    deleteTimeline(id) {
      this.timelines = this.timelines.filter((t) => t.id !== id)
      useTempStore().validateSelectedSegments()
    },
    deleteVocabulary(id) {
      this.vocabularies = this.vocabularies.filter((v) => v.id !== id)
    },
    deleteVocabularyTag(vocabId, tagId){
      const vocab = this.vocabularies.find((v) => v.id === vocabId)
      vocab.tags = vocab.tags.filter((t) => t.id !== tagId)
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
    generateScreenshot(frame) {
      api.runScreenshotGeneration(useMainStore().video, frame, this.id)
    },
    generateScreenshots(frames) {
      api.runScreenshotsGeneration(useMainStore().video, frames, this.id)
    },
    getSegmentForId(timelineId, segmentId) {
      const timeline = this.getTimelineById(timelineId)
      return timeline.data.find((s) => s.id === segmentId)
    },
    getTimelineById(id) {
      return this.timelines.find((t) => t.id === id)
    },
    importAnnotations() {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = '.eaf'
      fileInput.addEventListener('change', (event) => {
        const [file] = event.target.files
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target.result
          this.timelines = this.timelines.concat(parseEafAnnotations(content))
        }
        reader.readAsText(file)
      })
      fileInput.click()
    },
    initialize() {
      this.$subscribe((mutation, state) => {
        if (state.id === null || mutation.events?.key === 'id') return
        const copyState = JSON.parse(JSON.stringify(state))
        api.saveStore('undoable', copyState)

        useUndoStore().push('undoable', copyState)
      })

      api.onScreenshotsGeneration(this.onScreenshotsGeneration)
      api.onScreenshotGeneration(this.onScreenshotGeneration)
      api.onShotBoundaryDetection(this.onShotBoundaryDetection)
    },
    async loadStore(projectId) {
      const state = await api.loadStore('undoable', projectId)
      if (state === null) {
        this.id = projectId
      } else {
        this.$patch(state)
      }
    },
    async loadSubtitles() {
      this.subtitles = await api.loadSubtitles(this.id)
      return this.subtitles
    },
    mergeSegments(timelineId, segmentIds) {
      const timeline = this.getTimelineById(timelineId)
      const segment = timeline.data.find((s) => s.id === segmentIds[0])
      segmentIds.slice(1).forEach((segmentId) => {
        const index = timeline.data.findIndex((s) => s.id === segmentId)
        segment.start = Math.min(segment.start, timeline.data[index].start)
        segment.end = Math.max(segment.end, timeline.data[index].end)
        timeline.data.splice(index, 1)
      })
      useTempStore().validateSelectedSegments()
    },
    onScreenshotGeneration(data) {
      data.id = crypto.randomUUID()
      if (this.timelines.find((t) => t.type === 'screenshots-manual')) {
        this.timelines.find((t) => t.type === 'screenshots-manual').data.push(data)
      } else {
        this.timelines.push({
          data: [data],
          id: crypto.randomUUID(),
          name: 'Manual Screenshots',
          type: 'screenshots-manual'
        })
      }
    },
    onScreenshotsGeneration(data) {
      data.forEach((screenshot) => {
        screenshot.id = crypto.randomUUID()
      })
      this.timelines.push({
        data,
        id: crypto.randomUUID(),
        name: 'Screenshots',
        type: 'screenshots'
      })
    },
    onShotBoundaryDetection(data) {
      this.timelines.push({
        data: data.map((shot) => ({ end: shot[1], id: crypto.randomUUID(), start: shot[0] })),
        id: crypto.randomUUID(),
        name: 'Shots',
        type: 'shots'
      })
    },
    redo() {
      this.$patch(useUndoStore().redo('undoable'))
    },
    renameTimeline(id, name) {
      this.getTimelineById(id).name = name
    },
    renameVocabulary(id, name) {
      for (const vocab of this.vocabularies) {
        if (vocab.id === id) {
          vocab.name = name
          break
        }
        for (const tag of vocab.tags) {
          if (tag.id === id) {
            tag.name = name
            break
          }
        }
      }
    },
    runShotBoundaryDetection() {
      api.runShotBoundaryDetection(useMainStore().video)
    },
    splitSegment(timelineId, segmentId, position) {
      const timeline = this.getTimelineById(timelineId)
      const index = timeline.data.findIndex((s) => s.id === segmentId)
      const segment = timeline.data[index]
      timeline.data.splice(index + 1, 0, {
        end: segment.end,
        id: crypto.randomUUID(),
        start: position
      })
      segment.end = position - 1
    },
    undo() {
      this.$patch(useUndoStore().undo('undoable'))
    }
  }
})
