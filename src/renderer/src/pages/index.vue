<template>
  <div class="fill-height">
    <v-app-bar v-if="!electron" density="compact">
      <v-spacer></v-spacer>

      <v-btn icon @click="logout">
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main class="fill-height">
      <v-container id="main-container" class="d-sm-flex flex-column" max-width="1000">
        <v-row justify="center">
          <v-col cols="auto" align-self="center">
            <p class="text-h1">VIAN Light</p>

            <div class="mt-4 text-center">
              <span>Version: {{ metaStore.vianVersion }}</span>

              <v-chip
                v-if="metaStore.vianVersion !== metaStore.vianLatestVersion"
                color="primary"
                class="ms-2"
                href="https://github.com/Movie-Analytics/VIAN-light/releases"
                target="_blank"
                rel="noopener noreferrer"
                >Update available
              </v-chip>
            </div>
          </v-col>
        </v-row>

        <v-row justify="center">
          <v-col cols="auto" align-self="center">
            <v-btn @click="openVideo">Open video</v-btn>
          </v-col>

          <v-col cols="auto" align-self="center">
            <v-btn @click="importDialog = true">Import project</v-btn>
          </v-col>
        </v-row>

        <v-row class="align-content-start">
          <v-col
            v-for="project in metaStore.projects"
            :key="project.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card>
              <v-card-title>{{ project.name }}</v-card-title>

              <v-card-actions>
                <v-btn icon @click.stop="openProject(project.id)">
                  <v-icon>mdi-movie-search-outline</v-icon>
                </v-btn>

                <v-btn icon @click.stop="changeProjectName(project)">
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>

                <v-btn icon @click.stop="deleteProject(project.id)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <v-dialog v-model="renameDialog" persistent max-width="500">
        <v-card>
          <v-card-title>Rename Project</v-card-title>

          <v-card-text>
            <v-text-field v-model="projectName" label="New Project Name"></v-text-field>
          </v-card-text>

          <v-card-actions>
            <v-btn color="warning" @click="renameDialog = false">Cancel</v-btn>

            <v-btn color="primary" @click="saveProjectName">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="importDialog" persistent max-width="500" :disabled="importDisabled">
        <v-card>
          <v-card-title>Import Project</v-card-title>

          <v-card-text>
            <v-file-input v-model="importVideoFile" label="Video" accept="video/mp4"></v-file-input>

            <v-file-input
              v-model="importZipFile"
              label="Project file"
              accept="application/zip"
            ></v-file-input>
          </v-card-text>

          <v-card-actions>
            <v-btn color="warning" @click="importDialog = false">Cancel</v-btn>

            <v-btn color="primary" :disabled="importButtonDisabled" @click="importProject">
              Import
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-main>
  </div>
</template>

<script>
import { mapStores } from 'pinia'

import api from '@renderer/api'
import { useMainStore } from '@renderer/stores/main'
import { useMetaStore } from '@renderer/stores/meta'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoStore } from '@renderer/stores/undo'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'Index',

  data() {
    return {
      currentProjectId: null,
      importDialog: false,
      importDisabled: false,
      importVideoFile: null,
      importZipFile: null,
      projectName: '',
      renameDialog: false
    }
  },

  computed: {
    ...mapStores(useMetaStore, useMainStore, useTempStore, useUndoableStore, useUndoStore),

    electron() {
      // eslint-disable-next-line
      return isElectron
    },

    importButtonDisabled() {
      return this.importVideoFile === null || this.importZipFile === null
    }
  },

  watcher: {
    'tempStore.jobs'(val) {
      if (val[0]?.type === 'import-project' && val[0].status !== 'RUNNING') {
        this.importDisabled = false
        this.importDialog = false
        this.tempStore.$reset()
      }
    }
  },

  created() {
    this.metaStore.loadStore()
  },

  methods: {
    changeProjectName(project) {
      this.currentProjectId = project.id
      this.projectName = project.name
      this.renameDialog = true
    },

    deleteProject(projectId) {
      this.metaStore.deleteProject(projectId)
    },

    importProject() {
      this.tempStore.$reset()
      // eslint-disable-next-line
      if (isElectron) {
        this.metaStore.importProject(this.importVideoFile.path, this.importZipFile.path)
      } else {
        this.metaStore.importProject(this.importVideoFile, this.importZipFile)
      }
      this.importDisabled = true
    },

    logout() {
      api.logout()
      this.$router.push('login')
      this.mainStore.$reset()
      this.tempStore.$reset()
      this.undoableStore.$reset()
      this.undoStore.reset()
      this.metaStore.$reset()
    },

    openProject(projectId) {
      this.$router.push({ path: 'videoanalysis/' + projectId })
    },

    async openVideo() {
      const projectId = await this.metaStore.openVideo()
      if (projectId !== null) this.$router.push({ path: 'videoanalysis/' + projectId })
    },

    saveProjectName() {
      this.metaStore.renameProject(this.currentProjectId, this.projectName)
      this.renameDialog = false
    }
  }
}
</script>

<style scoped>
#main-container {
  height: 100%;
}
</style>
