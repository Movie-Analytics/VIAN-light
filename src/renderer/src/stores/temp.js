import { defineStore } from 'pinia'

export const useTempStore = defineStore('temp', {
  state: () => ({
    playPosition: 0,
    playJumpPosition: null,
    jobs: [],
    selectedSegments: [],
    imageCache: new Map(),
    tmpShot: null,
    muted: false
  }),
  actions: {
    terminateJob(id) {
      window.electronAPI.terminateJob(id)
    },
    reset() {
      this.playPosition = 0
      this.playJumpPosition = null
      this.jobs = []
      this.selectedSegments = []
      this.imageCache = new Map()
      this.tmpShot = null
      this.muted = false
    },
    initialize() {
      window.electronAPI.onJobsUpdate((channel, data) => {
        this.jobs = data
      })
    }
  }
})
