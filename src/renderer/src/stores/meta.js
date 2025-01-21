import { defineStore } from 'pinia'
import { useMainStore } from './main'
import { useUndoStore } from './undo'
import { api } from '@renderer/api'

export const useMetaStore = defineStore('meta', {
  state: () => ({
    projects: []
  }),
  actions: {
    initialize() {
      this.$subscribe((mutation, state) => {
        const copyState = JSON.parse(JSON.stringify(state))
        api().saveStore('meta', copyState)
        const undoStore = useUndoStore()
        undoStore.push('meta', copyState)
      })
    },
    async loadStore() {
      const state = await api().loadStore('meta')
      if (state !== undefined) {
        this.$patch(state)
      }
    },
    async open_video() {
      const video = await window.electronAPI.openVideoDialog()
      if (video === undefined) return undefined
      const project = {
        name: video.replace(/^.*[\\/]/, ''),
        id: crypto.randomUUID()
      }
      this.projects.push(project)
      const mainStore = useMainStore()
      mainStore.openVideo(project.id, video)
      return project.id
    },
    deleteProject(projectId) {
      this.projects = this.projects.filter((project) => project.id !== projectId)
    },
    renameProject(projectId, newName) {
      const project = this.projects.find((project) => project.id === projectId)
      if (project) {
        project.name = newName
      }
    }
  }
})
