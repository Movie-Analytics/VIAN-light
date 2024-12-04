import { defineStore } from 'pinia'

export const useMainStore = defineStore('main', {
  state: () => ({
    video: undefined,
    subtitles: undefined,
    shotBoundaries: [],
    timelines: [
      {
        type: 'shots',
        name: 'shots',
        data: [0, 100, 250, 500]
      },
      {
        type: 'shots',
        name: 'shots2',
        data: [0, 10, 350, 600]
      }
    ],
    fps: 25,
    jobs: []
  }),
  getters: {
    videoFileSrc() {
      if (this.video === undefined) return undefined
      return 'app://' + this.video
    },
    subtitleFileSrc() {
      if (this.subtitles === undefined) return undefined
      return 'app://' + this.subtitles
    }
  },
  actions: {
    async open_video() {
      this.video = await window.electronAPI.openVideoDialog()
      return this.video
    },
    async runShotBoundaryDetection() {
      window.electronAPI.runShotBoundaryDetection(this.video)
      window.electronAPI.onShotBoundaryDetection((channel, data) => {
        this.shotBoundaries = data
        this.timelines.push({ type: 'shots', name: 'Shots', data: data })
      })
    },
    async loadSubtitles() {
      this.subtitles = await window.electronAPI.loadSubtitles()
      return this.subtitles
    },
    initialize() {
      window.electronAPI.onJobsUpdate((channel, data) => {
        this.jobs = data
      })
    },
    terminateJob(id) {
      window.electronAPI.terminateJob(id)
    }
  }
})
