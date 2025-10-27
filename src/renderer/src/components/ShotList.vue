<template>
  <v-sheet id="top-sheet">
    <v-row class="ma-1">
      <v-select
        v-model="shotTimeline"
        :items="undoableStore.shotTimelines"
        label="Shot Timeline"
        item-title="name"
        item-value="id"
        class="me-2"
      />

      <v-select
        v-model="screenshotTimeline"
        :items="undoableStore.screenshotTimelines"
        label="Screenshot Timeline"
        item-title="name"
        item-value="id"
      />

      <v-menu :close-on-content-click="false" width="300">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon class="ms-2">
            <v-icon>mdi-magnify-plus</v-icon>
          </v-btn>
        </template>

        <v-sheet>
          <v-slider
            v-model="thumbZoom"
            :disabled="!screenshotTimeline"
            append-icon="mdi-magnify-plus-outline"
            prepend-icon="mdi-magnify-minus-outline"
            class="ma-2"
            hide-details
            :min="30"
            :max="100"
          ></v-slider>
        </v-sheet>
      </v-menu>
    </v-row>

    <div id="virtualscroll-container">
      <v-virtual-scroll v-if="shotTimeline" :items="shots">
        <template #default="{ item, index }">
          <div class="pa-3" :class="getEntryBgColor(item)">
            <div class="cursor-pointer" @click="jumpPlayer(item.start)">
              <span class="font-weight-bold">Shot {{ index + 1 }}</span>

              <span class="text-medium-emphasis">
                ({{ mainStore.timeReadableFrame(item.start) }} -
                {{ mainStore.timeReadableFrame(item.end) }})
              </span>
            </div>

            <div>
              <p>
                <span>Annotation: {{ item.annotation }}</span>
              </p>
            </div>

            <v-row v-if="screenshotTimeline" justify="start" class="ga-3 mx-3 py-3">
              <img
                v-for="img in getShotImages(item)"
                :key="img.id"
                :src="img.image"
                :style="thumbZoomStyle"
                loading="lazy"
                @click="imageClicked(img)"
              />
            </v-row>
          </div>
        </template>
      </v-virtual-scroll>
    </div>

    <ImageDialog ref="imageDialog"></ImageDialog>
  </v-sheet>
</template>

<script>
import ImageDialog from '@renderer/components/ImageDialog.vue'
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'ShotList',
  components: { ImageDialog },

  data: () => ({
    screenshotTimeline: null,
    shotTimeline: null,
    thumbZoom: 50
  }),

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore),

    shots() {
      const timeline = this.undoableStore.shotTimelines.find((s) => s.id === this.shotTimeline)
      return timeline ? timeline.data : []
    },

    thumbZoomStyle() {
      return {
        height: `${this.thumbZoom}px`
      }
    }
  },

  watch: {
    'undoableStore.timelines'(newVal) {
      const timelineIds = newVal.map((t) => t.id)
      if (!timelineIds.includes(this.shotTimeline)) this.shotTimeline = null
      if (!timelineIds.includes(this.screenshotTimeline)) this.screenshotTimeline = null
    }
  },

  methods: {
    getEntryBgColor(shot) {
      const framePos = this.tempStore.playPosition * this.mainStore.fps
      if (shot.start <= framePos && framePos <= shot.end) {
        return 'bg-grey-lighten-3'
      }
      return ''
    },

    getShotImages(shot) {
      const timeline = this.undoableStore.screenshotTimelines.find(
        (s) => s.id === this.screenshotTimeline
      )
      return timeline
        ? timeline.data.filter((s) => s.frame >= shot.start && s.frame < shot.end)
        : []
    },

    imageClicked(shot) {
      this.$refs.imageDialog.show(shot)
    },

    jumpPlayer(pos) {
      // Add extra time to ensure we are within the shot bounds
      this.tempStore.playJumpPosition = pos / this.mainStore.fps + 0.001
    }
  }
}
</script>

<style scoped>
#virtualscroll-container {
  display: flex;
  height: calc(100% - 100px);
}
#top-sheet {
  height: inherit;
}
</style>
