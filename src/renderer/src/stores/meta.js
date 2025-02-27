import { defineStore } from 'pinia'

import api from '@renderer/api'
import { useMainStore } from './main'
import { useUndoStore } from './undo'

export const useMetaStore = defineStore('meta', {
  state: () => ({
    projects: []
  }),
  /* eslint-disable-next-line vue/sort-keys */
  actions: {
    deleteProject(projectId) {
      this.projects = this.projects.filter((project) => project.id !== projectId)
    },
    initialize() {
      this.$subscribe((mutation, state) => {
        const copyState = JSON.parse(JSON.stringify(state))
        api.saveStore('meta', copyState)
        const undoStore = useUndoStore()
        undoStore.push('meta', copyState)
      })
    },
    async loadStore() {
      const state = await api.loadStore('meta')
      if (state !== null) {
        this.$patch(state)
      }
    },
    async openVideo() {
      const videoInfo = await api.openVideo()
      if (!videoInfo) return null
      const project = {
        id: crypto.randomUUID(),
        name: videoInfo.name
      }
      this.projects.push(project)
      const mainStore = useMainStore()
      mainStore.openVideo(project.id, videoInfo.location)
      return project.id
    },
    renameProject(projectId, newName) {
      const project = this.projects.find((p) => p.id === projectId)
      if (project) {
        project.name = newName
      }
    }
  }
})
