<template>
  <v-dialog v-model="isOpen" max-height="90vh" max-width="90vw">
    <v-card :title="title">
      <v-card-text class="container">
        <v-img :src="screenshot.image" contain max-height="60vh" />

        <v-list>
          <v-list-item v-for="item in associatedAnnotations" :key="item.timeline" class="item">
            <p class="timeline">{{ item.timeline }}</p>

            <v-label v-if="item.annotation" class="annotation ma-1">{{ item.annotation }}</v-label>

            <v-list v-if="item.vocabAnnotation.length">
              <v-chip v-for="tag in item.vocabAnnotation" :key="tag" class="ma-1">
                {{ tag }}
              </v-chip>
            </v-list>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-btn :text="$t('common.export')" @click="exportData"></v-btn>

        <v-spacer></v-spacer>

        <v-btn :text="$t('common.close')" @click="closeDialog"></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { exportScreenshot } from '../importexport'
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'ImageDialog',

  data() {
    return {
      associatedAnnotations: [],
      isOpen: false,
      screenshot: null
    }
  },

  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    title() {
      return (
        this.$t('components.imageDialog.screenshotAt') +
        ' ' +
        this.mainStore.timeReadableFrame(this.screenshot.frame, true)
      )
    }
  },

  methods: {
    closeDialog() {
      this.isOpen = false
    },

    exportData() {
      exportScreenshot(this.screenshot)
    },

    getAssociatedAnnotations() {
      const annotations = []
      for (const timeline of this.undoableStore.timelines) {
        const screenshotAnnotations = timeline.data.filter((annotation) => {
          if (annotation.start <= this.screenshot.frame && this.screenshot.frame < annotation.end) {
            return true
          }
          return false
        })
        if (
          screenshotAnnotations.length &&
          (screenshotAnnotations[0].annotation || screenshotAnnotations[0].vocabAnnotation.length)
        ) {
          annotations.push({
            annotation: screenshotAnnotations[0].annotation,
            timeline: timeline.name,
            vocabAnnotation: screenshotAnnotations[0].vocabAnnotation.map(
              (id) => this.undoableStore.vocabById.get(id)?.name
            )
          })
        }
      }
      this.associatedAnnotations = annotations
    },

    show(screenshot) {
      this.screenshot = screenshot
      this.getAssociatedAnnotations()
      this.isOpen = true
    }
  }
}
</script>

<style scoped>
.annotation {
  text-wrap: wrap;
}
.container {
  max-height: calc(90vh - 148px);
  overflow-y: auto;
  padding: 4px;
}
.item {
  margin-top: 8px;
  border-radius: 4px !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.timeline {
  width: 100%;
  text-align: center;
}
</style>
