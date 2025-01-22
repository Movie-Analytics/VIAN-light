<template>
  <div>
    <p v-if="tempStore.selectedSegments.size == 0">No elements in timeline selected</p>
    <v-sheet v-else-if="tempStore.selectedSegments.size == 1">
      <div v-if="selectedTimelineSegment && selectedTimelineSegment.image">
        <v-img :src="selectedTimelineSegment.image" />
      </div>
      <div v-else>
        <p class="font-weight-bold">Shot</p>
        {{ mainStore.timeReadableFrame(selectedTimelineSegment.start) }} -
        {{ mainStore.timeReadableFrame(selectedTimelineSegment.end) }}
        <v-text-field v-model="annotationBuffer" label="Annotations"></v-text-field>
      </div>
    </v-sheet>
    <p v-else>Multiple elements selected</p>
  </div>
</template>
<script>
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  data: () => ({
    annotationBuffer: null,
    timeout: null
  }),
  computed: {
    ...mapStores(useMainStore),
    ...mapStores(useUndoableStore),
    ...mapStores(useTempStore),
    selectedTimelineSegment() {
      if (this.tempStore.selectedSegments.size !== 1) return
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      return this.undoableStore.timelines
        .filter((t) => t.id == timelineid)[0]
        .data.filter((s) => s.id == shotid)[0]
    }
  },
  watch: {
    selectedTimelineSegment(newValue) {
      if (!newValue) return
      this.annotationBuffer = newValue.annotation
    },
    annotationBuffer(newValue) {
      if (newValue === this.selectedTimelineSegment.annotation) return

      if (this.timeout !== null) clearTimeout(this.timeout)

      this.timeout = setTimeout(() => {
        this.selectedTimelineSegment.annotation = newValue
        this.timeout = null
      }, 1000)
    }
  }
}
</script>
