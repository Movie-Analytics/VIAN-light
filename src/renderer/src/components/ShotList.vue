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
    </v-row>

    <div id="virtualscroll-container">
      <v-virtual-scroll v-if="shotTimeline" :items="shots">
        <template #default="{ item, index }">
          <div class="my-5">
            <div>
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

            <v-row v-if="screenshotTimeline" justify="start" class="ga-3 mx-3 pt-3">
              <img
                v-for="img in getShotImages(item)"
                :key="img.id"
                :src="img.thumbnail"
                class="shot-thumb"
                loading="lazy"
              />
            </v-row>
          </div>
        </template>
      </v-virtual-scroll>
    </div>
  </v-sheet>
</template>

<script>
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'ShotList',

  data: () => ({
    screenshotTimeline: null,
    shotTimeline: null
  }),

  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    shots() {
      const timeline = this.undoableStore.shotTimelines.find((s) => s.id === this.shotTimeline)
      return timeline ? timeline.data : []
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
    getShotImages(shot) {
      const timeline = this.undoableStore.screenshotTimelines.find(
        (s) => s.id === this.screenshotTimeline
      )
      return timeline
        ? timeline.data.filter((s) => s.frame >= shot.start && s.frame < shot.end)
        : []
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
.shot-thumb {
  height: 50px;
}
</style>
