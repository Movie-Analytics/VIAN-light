<template>
  <v-app-bar density="compact">
    <v-app-bar-title
      >VIAN-lite
      <span class="text-medium-emphasis text-body-2">{{ mainStore.video }}</span></v-app-bar-title
    >
    <v-menu :close-on-content-click="false">
      <template v-slot:activator="{ props }">
        <v-btn v-tooltip="'Job list'" :disabled="!hasJobs" icon v-bind="props">
          <v-badge color="error" dot v-if="runningJobs">
            <v-icon>mdi-format-list-bulleted</v-icon>
          </v-badge>
          <v-icon v-else>mdi-format-list-bulleted</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item v-for="(job, k, i) in mainStore.jobs" :key="i">
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
              @click="mainStore.terminateJob(job.id)"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-menu>
      <template v-slot:activator="{ props }">
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
        <v-col>info...</v-col>
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

export default {
  components: { Timelines, VideoPlayer },
  computed: {
    ...mapStores(useMainStore),
    runningJobs() {
      return Object.values(this.mainStore.jobs).some((j) => j.status === 'RUNNING')
    },
    hasJobs() {
      return Object.keys(this.mainStore.jobs).length > 0
    }
  },
  methods: {
    homeClicked() {
      this.$router.push('/')
    },
    shotBoundaryDetectionClicked() {
      this.mainStore.runShotBoundaryDetection()
    },
    loadSubtitles() {
      this.mainStore.loadSubtitles()
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
