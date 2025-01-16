import { defineStore } from 'pinia'

export const useTempStore = defineStore('temp', {
  state: () => ({
    playPosition: 0,
    playJumpPosition: null,
    jobs: [],
    selectedSegments: [],
    imageCache: new Map(),
    tmpShot: null
  }),
  actions: {
    terminateJob(id) {
      window.electronAPI.terminateJob(id)
    },
    reset() {
      this.playPosition = 0
      this.jobs = []
      this.selectedSegments = []
      this.imageCache = new Map()
    },
    initialize() {
      window.electronAPI.onJobsUpdate((channel, data) => {
        this.jobs = data
      })
    }
  }
})
