<template>
  <div class="px-5">
    <v-row>
      <v-col style="min-width: 400px">
        <v-card>
          <video-player></video-player>
        </v-card>
      </v-col>
      <v-col cols="6" style="max-width: 700px">
        <v-card>
          <v-tabs v-model="tab" show-arrows>
            <v-tab value="info">Info</v-tab>
            <v-tab :disabled="undoableStore.shotTimelines.length == 0" value="shots">Shots</v-tab>
            <v-tab value="selection">Selection</v-tab>
          </v-tabs>
          <v-card-text>
            <v-tabs-window v-model="tab">
              <v-tabs-window-item value="info">
                <p v-if="mainStore.fps">FPS: {{ mainStore.fps }}</p>
              </v-tabs-window-item>
              <v-tabs-window-item value="shots" style="height: 400px">
                <shot-list></shot-list>
              </v-tabs-window-item>
              <v-tabs-window-item value="selection">
                <shot-detail></shot-detail>
              </v-tabs-window-item>
            </v-tabs-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-card>
          <v-card-text>
            <timelines></timelines>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script>
import { mapStores } from 'pinia'

import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'
import ShotDetail from '@renderer/components/ShotDetail.vue'
import ShotList from '@renderer/components/ShotList.vue'
import Timelines from '@renderer/components/Timelines.vue'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'

export default {
  components: { Timelines, VideoPlayer, ShotList, ShotDetail },
  data: () => ({
    tab: null
  }),
  computed: {
    ...mapStores(useMainStore, useUndoableStore)
  }
}
</script>
