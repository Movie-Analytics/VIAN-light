import { defineStore } from 'pinia'

import api from '@renderer/api'
import { useMainStore } from './main'
import { useUndoStore } from './undo'
import { version } from '../../../../package.json'

export const useMetaStore = defineStore('meta', {
  state: () => ({
    projects: [],
    vianLatestVersion: version,
    vianVersion: version
  }),
  /* eslint-disable-next-line vue/sort-keys */
  actions: {
    async checkVianUpdate() {
      try {
        const r = await fetch('https://api.github.com/repos/Movie-Analytics/VIAN/releases/latest')
        if (!r.ok) {
          throw new Error(`HTTP ${r.status} ${r.statusText}`)
        }
        const data = await r.json()
        this.vianLatestVersion = data.tag_name
      } catch (e) {
        console.warn('Could not fetch latest version', e)
      }
    },
    deleteProject(projectId) {
      this.projects = this.projects.filter((project) => project.id !== projectId)
    },
    importProject(videoFile, zipFile) {
      api.importProject(videoFile, zipFile)
    },
    initialize() {
      this.$subscribe((mutation, state) => {
        const copyState = JSON.parse(JSON.stringify(state))
        api.saveStore('meta', copyState)
        const undoStore = useUndoStore()
        undoStore.push('meta', copyState)
      })

      api.onImportProject(this.onImportProject)
      this.checkVianUpdate()
    },
    async loadStore() {
      const state = await api.loadStore('meta')
      if (state !== null) {
        this.$patch(state)
      }
    },
    onImportProject(project) {
      this.projects.push(project)
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
