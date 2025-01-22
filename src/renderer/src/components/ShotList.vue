<template>
  <v-sheet>
    <v-select
      v-model="shotTimeline"
      :items="undoableStore.shotTimelines"
      label="Shot Timeline"
      item-title="name"
      item-value="id"
    >
    </v-select>
    <v-virtual-scroll v-if="shotTimeline" :height="300" :items="shots">
      <template #default="{ item, index }">
        <div class="my-2">
          <span class="font-weight-bold">Shot {{ index + 1 }}</span>
          <span class="text-medium-emphasis">
            ({{ mainStore.timeReadableFrame(item.start) }} -
            {{ mainStore.timeReadableFrame(item.end) }})
          </span>
          <p>
            <span>Annotation: {{ item.annotation }}</span>
          </p>
        </div>
      </template>
    </v-virtual-scroll>
  </v-sheet>
</template>

<script>
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  data: () => ({
    shotTimeline: null
  }),
  computed: {
    ...mapStores(useMainStore),
    ...mapStores(useUndoableStore),
    shots() {
      if (!this.shotTimeline) return []

      return this.undoableStore.shotTimelines.filter((s) => s.id === this.shotTimeline)[0].data
    }
  }
}
</script>
