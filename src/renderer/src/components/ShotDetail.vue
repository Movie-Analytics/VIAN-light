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
        <v-text-field
          v-model="annotationBuffer"
          :disabled="selectedTimelineSegment.locked"
          label="Annotations"
        ></v-text-field>

        <v-checkbox v-model="selectedTimelineSegment.locked" label="Lock segment"></v-checkbox>
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
  name: 'ShotDetail',

  data: () => ({
    annotationBuffer: '',
    timeout: null
  }),

  computed: {
    ...mapStores(useMainStore, useUndoableStore, useTempStore),

    selectedTimelineSegment() {
      if (this.tempStore.selectedSegments.size !== 1) return null
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      return this.undoableStore.timelines
        .find((t) => t.id === timelineid)
        .data.find((s) => s.id === shotid)
    }
  },

  watch: {
    annotationBuffer(newValue) {
      if (newValue === this.selectedTimelineSegment.annotation) return

      clearTimeout(this.timeout)

      this.timeout = setTimeout(() => {
        if (this.selectedTimelineSegment) {
          this.selectedTimelineSegment.annotation = newValue
        }
        this.timeout = null
      }, 1000)
    },

    selectedTimelineSegment(newValue) {
      if (newValue) {
        this.annotationBuffer = newValue.annotation
      }
    }
  }
}
</script>
