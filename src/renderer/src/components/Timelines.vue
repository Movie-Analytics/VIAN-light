<template>
  <v-sheet>
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
        <v-list id="timeline-list" lines="one">
          <v-list-group v-for="timeline in undoableStore.timelines" :key="timeline">
            <template #activator="{ props, isOpen }">
              <v-list-item :title="timeline.name">
                <template #append>
                  <v-list-item-action start>
                    <v-btn
                      v-if="typeof timeline.vocabulary === 'string'"
                      icon
                      v-bind="props"
                      variant="text"
                      density="compact"
                      class="me-2"
                      @click="changeVisibility(timeline.id, undefined, isOpen)"
                    >
                      <v-icon>mdi-expand-all</v-icon>
                    </v-btn>

                    <v-menu>
                      <template #activator="{ props }">
                        <v-btn variant="text" density="compact" icon v-bind="props">
                          <v-icon>mdi-dots-vertical</v-icon>
                        </v-btn>
                      </template>

                      <v-list class="pb-0 pt-0">
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

                        <v-list-item
                          title="Link to vocabulary"
                          :disabled="
                            !vocabularyExists ||
                            typeof timeline.vocabulary === 'string' ||
                            timeline.type !== 'shots'
                          "
                          @click="linkVocabDialogOpen(timeline.id)"
                        ></v-list-item>
                      </v-list>
                    </v-menu>
                  </v-list-item-action>
                </template>
              </v-list-item>
            </template>

            <template v-if="typeof timeline.vocabulary === 'string'">
              <v-list class="pb-0 pt-0">
                <v-list-group
                  v-for="category in getVocabulary(timeline.vocabulary).categories"
                  :key="category.id"
                >
                  <template #activator="{ props, isOpen }">
                    <v-list-item
                      :title="category.name"
                      v-bind="props"
                      @click="changeVisibility(timeline.id, category.id, isOpen)"
                    ></v-list-item>
                  </template>

                  <v-list-item v-for="tag in category.tags" :key="tag.id" :title="tag.name">
                  </v-list-item>
                </v-list-group>
              </v-list>
            </template>
          </v-list-group>

          <v-list-item v-tooltip="'Add new track'" @click="addTimeline">
            <v-icon>mdi-playlist-plus</v-icon>
          </v-list-item>
        </v-list>
      </v-col>

      <v-col>
        <TimelineCanvas></TimelineCanvas>
      </v-col>
    </v-row>

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

    <v-dialog v-model="linkVocabDialog" persistent max-width="400">
      <v-card>
        <v-card-title>Link vocabulary to timeline</v-card-title>

        <v-card-text>
          <v-select
            v-model="selectedVocab"
            label="Select vocabulary"
            :items="vocabularies"
          ></v-select>
        </v-card-text>

        <v-card-actions>
          <v-btn color="warning" @click="linkVocabDialog = false">Cancel</v-btn>

          <v-btn color="primary" @click="linkVocab">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-sheet>
</template>

<script>
import { mapStores } from 'pinia'

import TimelineCanvas from '@renderer/components/TimelineCanvas.vue'
import api from '@renderer/api'
import shortcuts from '@renderer/shortcuts'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'Timelines',
  components: { TimelineCanvas },

  data() {
    return {
      linkVocabDialog: false,
      renameDialog: false,
      selectedTimeline: null,
      selectedVocab: null,
      timelineName: ''
    }
  },

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore),

    segmentDeletable() {
      return this.tempStore.selectedSegments.size > 0 && !this.segmentsLocked
    },

    segmentMergable() {
      if (this.tempStore.selectedSegments.size <= 1 || this.segmentsLocked) return false
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
      if (this.tempStore.selectedSegments.size !== 1 || this.segmentsLocked) return false
      const playFps = Math.round(this.tempStore.playPosition * this.mainStore.fps)
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      const segment = this.undoableStore.getSegmentForId(timelineid, shotid)
      return segment.start < playFps && segment.end > playFps
    },

    segmentsLocked() {
      return Array.from(this.tempStore.selectedSegments.entries())
        .map((shot) => this.undoableStore.getSegmentForId(shot[1], shot[0]).locked)
        .some((v) => v)
    },

    shotTimelinesExists() {
      return this.undoableStore.timelines.filter((t) => t.type === 'shots').length > 0
    },

    vocabularies() {
      return this.undoableStore.vocabularies.map((v) => ({ title: v.name, value: v.id }))
    },

    vocabularyExists() {
      return this.undoableStore.vocabularies.length > 0
    }
  },

  watch: {
    'undoableStore.timelines'(newVal, oldVal) {
      if (newVal.length !== oldVal.length) {
        this.createTimelineFolds()
      }
    },

    'undoableStore.vocabularies'() {
      this.createTimelineFolds()
    }
  },

  mounted() {
    // Register shorcuts and menu actions
    shortcuts.register('Delete', this.segmentDelete)
    shortcuts.register('m', this.segmentMerge)
    shortcuts.register('s', this.segmentSplit)
    api.onSegmentDelete(this.segmentDelete)
    api.onSegmentMerge(this.segmentMerge)
    api.onSegmentSplit(this.segmentSplit)
    this.createTimelineFolds()
  },

  beforeUnmount() {
    for (const key of ['m', 's', 'Delete']) {
      shortcuts.clear(key)
    }
  },

  methods: {
    addTimeline() {
      this.undoableStore.addNewTimeline()
    },

    changeVisibility(timelineId, categoryId, isopen) {
      const timeline = this.tempStore.timelinesFold[timelineId]
      if (typeof categoryId === 'string') {
        const category = timeline.categories.find((c) => c.id === categoryId)
        category.visible = !isopen
      } else {
        timeline.visible = !isopen
      }
    },

    createTimelineFolds() {
      this.tempStore.timelinesFold = Object.fromEntries(
        this.undoableStore.timelines.map((t) => {
          if (typeof t.vocabulary !== 'string') {
            return [t.id, { visible: false }]
          }
          const categories = JSON.parse(
            JSON.stringify(
              this.undoableStore.vocabularies.find((v) => v.id === t.vocabulary).categories
            )
          )
          categories.forEach((c) => {
            c.visible = false
          })
          return [t.id, { categories, visible: false }]
        })
      )
    },

    deleteTimeline(id) {
      this.undoableStore.deleteTimeline(id)
    },

    duplicateTimeline(id) {
      this.undoableStore.duplicateTimeline(id)
    },

    getVocabulary(id) {
      return this.undoableStore.vocabularies.find((v) => v.id === id)
    },

    linkVocab() {
      this.undoableStore.linkTimelineToVocabulary(this.selectedTimeline, this.selectedVocab)
      this.linkVocabDialog = false
      this.createTimelineFolds()
    },

    linkVocabDialogOpen(id) {
      this.linkVocabDialog = true
      this.selectedTimeline = id
      this.selectedVocab = null
    },

    renameDialogOpen(id) {
      this.timelineName = ''
      this.renameDialog = true
      this.selectedTimeline = id
    },

    renameTimeline() {
      this.undoableStore.renameTimeline(this.selectedTimeline, this.timelineName)
      this.renameDialog = false
    },

    segmentDelete() {
      if (!this.segmentDeletable) return
      const segments = this.tempStore.selectedSegments
      this.undoableStore.deleteSegments(segments.values().next().value, Array.from(segments.keys()))
      this.tempStore.selectedSegments = new Map()
    },

    segmentMerge() {
      if (!this.segmentMergable) return
      const segments = this.tempStore.selectedSegments
      this.undoableStore.mergeSegments(segments.values().next().value, Array.from(segments.keys()))
      this.tempStore.selectedSegments = new Map()
    },

    segmentSplit() {
      if (!this.segmentSplitable) return
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      this.undoableStore.splitSegment(
        timelineid,
        shotid,
        Math.round(this.tempStore.playPosition * this.mainStore.fps)
      )
      this.tempStore.selectedSegments = new Map()
    }
  }
}
</script>

<style scoped>
#timeline-list {
  padding-top: 30px;
}
</style>
