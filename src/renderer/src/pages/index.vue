<template>
  <v-main>
    <v-container class="fill-height flex-column">
      <v-row justify="center">
        <v-col align-self="center">
          <p class="text-h1">VIAN light</p>
        </v-col>
      </v-row>
      <v-row justify="center">
        <v-col align-self="center">
          <v-btn @click="openVideo">Open video</v-btn>
        </v-col>
      </v-row>
      <v-row>
        <v-col v-for="project in metaStore.projects" :key="project.id" style="min-width: 200px">
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
    <v-dialog v-model="renameDialog" persistent>
      <v-card>
        <v-card-title>Rename Project</v-card-title>
        <v-card-text>
          <v-text-field v-model="projectName" label="New Project Name"></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" @click="saveProjectName">Save</v-btn>
          <v-btn color="secondary" @click="renameDialog = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-main>
</template>

<script>
import { mapStores } from 'pinia'

import { useMetaStore } from '@renderer/stores/meta'

export default {
  data() {
    return {
      renameDialog: false,
      projectName: '',
      currentProjectId: null
    }
  },
  computed: {
    ...mapStores(useMetaStore)
  },
  created() {
    this.metaStore.loadStore()
  },
  methods: {
    async openVideo() {
      const projectId = await this.metaStore.open_video()
      if (projectId !== undefined) this.$router.push({ path: 'videoanalysis/' + projectId })
    },
    deleteProject(projectId) {
      this.metaStore.deleteProject(projectId)
    },
    changeProjectName(project) {
      this.currentProjectId = project.id
      this.projectName = project.name
      this.renameDialog = true
    },
    saveProjectName() {
      this.metaStore.renameProject(this.currentProjectId, this.projectName)
      this.renameDialog = false
    },
    openProject(projectId) {
      this.$router.push({ path: 'videoanalysis/' + projectId })
    }
  }
}
</script>
