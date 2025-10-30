<template>
    <v-row>
      <v-col id="video-col" cols="6" class="d-flex" style="flex-direction:column">
        <v-card class="flex-grow-1 pb-5">
          <VideoPlayer></VideoPlayer>
        </v-card>
      </v-col>

      <v-col id="info-col" cols="6" class="d-flex" style="flex-direction:column">
        <v-card class="flex-grow-1 pb-5">
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

              <v-tabs-window-item id="shot-list-tab" value="shots" class="h-100 overflow-y-auto">
                <ShotList></ShotList>
              </v-tabs-window-item>

              <v-tabs-window-item value="selection">
                <ShotDetail></ShotDetail>
              </v-tabs-window-item>
            </v-tabs-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

  <v-row>
    <v-col cols="12">
      <v-card class="flex-grow-1">
        <v-card-text>
          <Timelines></Timelines>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script>
import { mapStores } from 'pinia'

import ShotDetail from '@renderer/components/ShotDetail.vue'
import ShotList from '@renderer/components/ShotList.vue'
import Timelines from '@renderer/components/Timelines.vue'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'LayoutTibava',
  components: { ShotDetail, ShotList, Timelines, VideoPlayer },

  data: () => ({
    tab: null
  }),

  computed: {
    ...mapStores(useMainStore, useUndoableStore)
  }
}
</script>

<style scoped>

/* #video-col {
  min-width: 400px;
  max-height: 100%;
}

#info-col {
  max-width: 700px;
  max-height: 100%;
} */

/* #shot-list-tab {
  height: 400px;
} */

</style>