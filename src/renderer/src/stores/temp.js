import { defineStore } from 'pinia'
import { api } from '@renderer/api'

export const useTempStore = defineStore('temp', {
  state: () => ({
    playPosition: 0,
    playJumpPosition: null,
    jobs: [],
    selectedSegments: new Map(), // shot id -> timeline id
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
      this.selectedSegments = new Map()
      this.imageCache = new Map()
      this.tmpShot = null
      this.muted = false
    },
    initialize() {
      api().onJobsUpdate((channel, data) => {
        this.jobs = data
      })
    }
  }
})
