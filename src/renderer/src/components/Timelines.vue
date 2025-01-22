<template>
  <v-card>
    <v-card-title>Timelines</v-card-title>
    <v-card-text>
      <v-row>
        <v-btn
          density="compact"
          variant="text"
          :disabled="!segmentDeletable"
          icon
          @click="segmentDelete"
        >
          <v-icon>mdi-delete</v-icon>
        </v-btn>
        <v-btn
          density="compact"
          variant="text"
          :disabled="!segmentSplitable"
          icon
          @click="segmentSplit"
        >
          <v-icon>mdi-table-split-cell</v-icon>
        </v-btn>
        <v-btn
          density="compact"
          variant="text"
          :disabled="!segmentMergable"
          icon
          @click="segmentMerge"
        >
          <v-icon>mdi-table-merge-cells</v-icon>
        </v-btn>
      </v-row>
      <v-row>
        <v-col cols="3">
          <v-list lines="one" style="padding-top: 30px">
            <v-list-item
              v-for="timeline in undoableStore.timelines"
              :key="timeline"
              :title="timeline.name"
            >
              <template #append>
                <v-list-item-action start>
                  <v-menu>
                    <template #activator="{ props }">
                      <v-btn variant="text" density="compact" icon v-bind="props">
                        <v-icon>mdi-dots-vertical</v-icon>
                      </v-btn>
                    </template>
                    <v-list>
                      <v-list-item
                        title="Duplicate"
                        @click="duplicateTimeline(timeline.id)"
                      ></v-list-item>
                      <v-list-item
                        title="Delete"
                        @click="deleteTimeline(timeline.id)"
                      ></v-list-item>
                      <v-list-item
                        title="Rename"
                        @click="renameDialogOpen(timeline.id)"
                      ></v-list-item>
                    </v-list>
                  </v-menu>
                </v-list-item-action>
              </template>
            </v-list-item>
            <v-list-item @click="addTimeline">
              <v-icon>mdi-playlist-plus</v-icon>
            </v-list-item>
          </v-list>
        </v-col>
        <v-col>
          <timeline-canvas></timeline-canvas>
        </v-col>
      </v-row>
    </v-card-text>
    <v-dialog v-model="renameDialog" persistent max-width="400">
      <v-card>
        <v-card-title>Rename Timeline</v-card-title>
        <v-card-text>
          <v-text-field v-model="timelineName" label="New Timeline Name"></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-btn color="warning" @click="renameDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="renameTimeline">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script>
import { mapStores } from 'pinia'

import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'
import TimelineCanvas from '@renderer/components/TimelineCanvas.vue'

export default {
  components: { TimelineCanvas },
  data() {
    return {
      renameDialog: false,
      timelineName: '',
      renameTimelineId: null
    }
  },
  computed: {
    ...mapStores(useMainStore),
    ...mapStores(useTempStore),
    ...mapStores(useUndoableStore),
    segmentDeletable() {
      return this.tempStore.selectedSegments.size > 0
    },
    segmentMergable() {
      if (this.tempStore.selectedSegments.size <= 1) return false
      const timeline = this.undoableStore.timelines.filter(
        (t) => t.id === this.tempStore.selectedSegments.values().next().value
      )[0]
      if (timeline.type !== 'shots') return false

      const timelineDataIds = timeline.data.map((d) => d.id)
      const indices = Array.from(this.tempStore.selectedSegments.keys())
        .map((s) => timelineDataIds.indexOf(s))
        .sort((a, b) => a - b)
      return indices[indices.length - 1] - indices[0] === indices.length - 1
    },
    segmentSplitable() {
      if (this.tempStore.selectedSegments.size != 1) return false
      const playFps = Math.round(this.tempStore.playPosition * this.mainStore.fps)
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      const segment = this.undoableStore.getSegmentForId(timelineid, shotid)
      return segment.start < playFps && segment.end > playFps && segment.start !== undefined
    }
  },
  methods: {
    segmentDelete() {
      const segments = this.tempStore.selectedSegments
      this.undoableStore.deleteSegments(segments.values().next().value, Array.from(segments.keys()))
      this.tempStore.selectedSegments = new Map()
    },
    segmentMerge() {
      const segments = this.tempStore.selectedSegments
      this.undoableStore.mergeSegments(segments.values().next().value, Array.from(segments.keys()))
      this.tempStore.selectedSegments = new Map()
    },
    segmentSplit() {
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      this.undoableStore.splitSegment(
        timelineid,
        shotid,
        Math.round(this.tempStore.playPosition * this.mainStore.fps)
      )
      this.tempStore.selectedSegments = new Map()
    },
    deleteTimeline(id) {
      this.undoableStore.deleteTimeline(id)
    },
    duplicateTimeline(id) {
      this.undoableStore.duplicateTimeline(id)
    },
    renameTimeline() {
      this.undoableStore.renameTimeline(this.renameTimelineId, this.timelineName)
      this.renameDialog = false
    },
    renameDialogOpen(id) {
      this.timelineName = ''
      this.renameDialog = true
      this.renameTimelineId = id
    },
    addTimeline() {
      this.undoableStore.addNewTimeline()
    }
  }
}
</script>
