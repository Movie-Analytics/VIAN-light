<template>
  <v-sheet style="height: inherit">
    <v-row class="ma-1">
      <v-select
        v-model="shotTimeline"
        :items="undoableStore.shotTimelines"
        label="Shot Timeline"
        item-title="name"
        item-value="id"
        class="me-2"
      >
      </v-select>
      <v-select
        v-model="screenshotTimeline"
        :items="undoableStore.screenshotTimelines"
        label="Screenshot Timeline"
        item-title="name"
        item-value="id"
      >
      </v-select>
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
            <v-row
              v-if="screenshotTimeline != null"
              justify="start"
              class="overflow-x-auto mx-3 pt-3 flex-nowrap ga-3"
            >
              <img
                v-for="img in getShotImages(item)"
                :key="img.id"
                :src="img.thumbnail"
                style="height: 50px"
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
  data: () => ({
    shotTimeline: null,
    screenshotTimeline: null
  }),
  computed: {
    ...mapStores(useMainStore),
    ...mapStores(useUndoableStore),
    shots() {
      if (!this.shotTimeline) return []

      return this.undoableStore.shotTimelines.filter((s) => s.id === this.shotTimeline)[0].data
    }
  },
  methods: {
    getShotImages(shot) {
      if (this.screenshotTimeline === null) return null

      return this.undoableStore.screenshotTimelines
        .filter((s) => s.id === this.screenshotTimeline)[0]
        .data.filter((s) => s.frame >= shot.start && s.frame < shot.end)
    }
  }
}
</script>
<style scoped>
#virtualscroll-container {
  display: flex;
  height: calc(100% - 100px);
}
</style>
