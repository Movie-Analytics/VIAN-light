<template>
  <v-app-bar density="compact">
    <v-app-bar-title
      >VIAN-lite
      <span class="text-medium-emphasis text-body-2">{{ mainStore.video }}</span></v-app-bar-title
    >
    <v-btn :disabled="!isUndoable" icon @click="undo">
      <v-icon>mdi-undo</v-icon>
    </v-btn>
    <v-btn :disabled="!isRedoable" icon @click="redo">
      <v-icon>mdi-redo</v-icon>
    </v-btn>
    <v-menu :close-on-content-click="false">
      <template #activator="{ props }">
        <v-btn v-tooltip="'Job list'" :disabled="!hasJobs" icon v-bind="props">
          <v-badge v-if="runningJobs" color="error" dot>
            <v-icon>mdi-format-list-bulleted</v-icon>
          </v-badge>
          <v-icon v-else>mdi-format-list-bulleted</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item v-for="(job, k, i) in tempStore.jobs" :key="i">
          <v-list-item-title>{{ job.type }}</v-list-item-title>
          <template #append>
            <v-badge :color="statusToColor(job.status)" :content="job.status" inline></v-badge>
          </template>
          <template #prepend>
            <v-btn
              v-if="job.status === 'RUNNING'"
              icon
              variant="text"
              class="me-2"
              @click="tempStore.terminateJob(job.id)"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-menu>
      <template #activator="{ props }">
        <v-btn v-tooltip="'Analysis tools'" icon v-bind="props">
          <v-icon>mdi-tools</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item @click="shotBoundaryDetectionClicked">
          <v-list-item-title>Shotboundary detection</v-list-item-title>
        </v-list-item>
        <v-list-item @click="loadSubtitles">
          <v-list-item-title>Load subtitles</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-btn v-tooltip="'Home'" icon @click="homeClicked">
      <v-icon>mdi-home</v-icon>
    </v-btn>
  </v-app-bar>
  <v-main class="ma-3">
    <v-container>
      <v-row>
        <v-col>
          <video-player></video-player>
        </v-col>
        <v-col>
          <p v-if="mainStore.fps">FPS: {{ mainStore.fps }}</p>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <timelines></timelines>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<script>
import { mapStores } from 'pinia'

import VideoPlayer from '@renderer/components/VideoPlayer.vue'
import Timelines from '@renderer/components/Timelines.vue'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'
import { useUndoStore } from '@renderer/stores/undo'

export default {
  components: { Timelines, VideoPlayer },
  computed: {
    ...mapStores(useMainStore),
    ...mapStores(useTempStore),
    ...mapStores(useUndoableStore),
    ...mapStores(useUndoStore),
    runningJobs() {
      return Object.values(this.tempStore.jobs).some((j) => j.status === 'RUNNING')
    },
    hasJobs() {
      return Object.keys(this.tempStore.jobs).length > 0
    },
    isUndoable() {
      return this.undoStore.isUndoable('undoable')
    },
    isRedoable() {
      return this.undoStore.isRedoable('undoable')
    }
  },
  created() {
    this.mainStore.loadStore(this.$route.params.id)
    this.undoableStore.loadStore(this.$route.params.id)
  },
  methods: {
    homeClicked() {
      this.$router.push('/')
      this.mainStore.reset()
      this.tempStore.reset()
      this.undoableStore.reset()
      this.undoStore.reset()
    },
    undo() {
      this.undoableStore.undo('undoable')
    },
    redo() {
      this.undoableStore.redo('undoable')
    },
    shotBoundaryDetectionClicked() {
      this.undoableStore.runShotBoundaryDetection()
    },
    loadSubtitles() {
      this.undoableStore.loadSubtitles()
    },
    statusToColor(status) {
      if (status === 'RUNNING') return 'yellow'
      else if (status === 'ERROR') return 'error'
      else if (status === 'DONE') return 'success'
      else if (status === 'CANCELED') return 'black'
      else return 'white'
    }
  }
}
</script>
