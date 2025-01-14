import { defineStore } from 'pinia'
import { useUndoableStore } from './undoable'

export const useMainStore = defineStore('main', {
  state: () => ({
    video: null,
    fps: null,
    videoDuration: null,
    id: null
  }),
  getters: {
    videoFileSrc() {
      if (this.video === null) return undefined
      return 'app://' + this.video
    }
  },
  actions: {
    async openVideo(id, video) {
      // TODO could become race condition
      const undoableStore = useUndoableStore()
      this.id = id
      undoableStore.id = id
      this.video = video
      if (this.fps === null && this.video !== null) {
        window.electronAPI.getVideoInfo(this.video)
      }
    },
    initialize() {
      this.$subscribe((mutation, state) => {
        if (this.id === null) return
        const copyState = JSON.parse(JSON.stringify(state))
        window.electronAPI.saveStore('main', copyState)
      })
      // set up listener
      window.electronAPI.onVideoInfo((channel, data) => {
        this.fps = data.fps
      })
    },
    async loadStore(projectId) {
      const state = await window.electronAPI.loadStore('main', projectId)
      if (state !== undefined) {
        this.$patch(state)
      }
    },
    timeReadableSec(t, subsec = false) {
      const formattedHours = String(Math.floor(t / 60 / 60)).padStart(2, '0')
      const formattedMinutes = String(Math.floor(t / 60) % 60).padStart(2, '0')
      let formattedSeconds
      if (subsec) {
        formattedSeconds = String((t % 60).toFixed(2)).padStart(2, '0')
      } else {
        formattedSeconds = String(Math.round(t % 60)).padStart(2, '0')
      }
      return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
    },
    reset() {
      this.id = null
      this.video = null
      this.fps = null
      this.videoDuration = null
    }
  }
})
