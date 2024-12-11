import { defineStore } from 'pinia'
import { useUndoStore } from './undo'

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
      window.electronAPI.runShotBoundaryDetection(this.video)
      window.electronAPI.onShotBoundaryDetection((channel, data) => {
        this.timelines.push({ type: 'shots', name: 'Shots', data: data })
      })
    },
    async loadSubtitles() {
      this.subtitles = await window.electronAPI.loadSubtitles()
      return this.subtitles
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
