import { defineStore } from 'pinia'

export const useTempStore = defineStore('temp', {
  state: () => ({
    playPosition: 0,
    jobs: [],
    selectedSegments: []
  }),
  actions: {
    terminateJob(id) {
      window.electronAPI.terminateJob(id)
    },
    reset() {
      this.playPosition = 0
      this.jobs = []
      this.selectedSegments = []
    },
    initialize() {
      window.electronAPI.onJobsUpdate((channel, data) => {
        this.jobs = data
      })
    }
  }
})
