<template>
  <v-app-bar density="compact">
    <v-app-bar-title
      >VIAN-lite
      <span class="text-medium-emphasis text-body-2">{{ mainStore.video }}</span></v-app-bar-title
    >
    <v-btn :disabled="!isUndoable" icon @click="undo">
      <v-icon>mdi-undo</v-icon>
    </v-btn>
    <v-btn :disabled="!isRedoable" icon @click="redo">
      <v-icon>mdi-redo</v-icon>
    </v-btn>
    <v-menu :close-on-content-click="false">
      <template #activator="{ props }">
        <v-btn v-tooltip="'Job list'" :disabled="!hasJobs" icon v-bind="props">
          <v-badge v-if="runningJobs" color="error" dot>
            <v-icon>mdi-format-list-bulleted</v-icon>
          </v-badge>
          <v-icon v-else>mdi-format-list-bulleted</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item v-for="(job, k, i) in tempStore.jobs" :key="i">
          <v-list-item-title>{{ job.type }}</v-list-item-title>
          <template #append>
            <v-badge :color="statusToColor(job.status)" :content="job.status" inline></v-badge>
          </template>
          <template #prepend>
            <v-btn
              v-if="job.status === 'RUNNING'"
              icon
              variant="text"
              class="me-2"
              @click="tempStore.terminateJob(job.id)"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-menu>
      <template #activator="{ props }">
        <v-btn v-tooltip="'Analysis tools'" icon v-bind="props">
          <v-icon>mdi-tools</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item @click="shotBoundaryDetectionClicked">
          <v-list-item-title>Shotboundary Detection</v-list-item-title>
        </v-list-item>
        <v-list-item @click="loadSubtitles">
          <v-list-item-title>Load Subtitles</v-list-item-title>
        </v-list-item>
        <v-list-item @click="genScreenshotDialog = true">
          <v-list-item-title>Generate Screenshots</v-list-item-title>
        </v-list-item>
        <v-list-item @click="importAnnotations">
          <v-list-item-title>Import Annotations</v-list-item-title>
        </v-list-item>
        <v-list-item>
          <v-list-item-title>Export</v-list-item-title>
          <template #append>
            <v-icon icon="mdi-menu-right" size="x-small"></v-icon>
          </template>
          <v-menu :open-on-focus="false" activator="parent" open-on-hover submenu>
            <v-list>
              <v-list-item @click="exportAnnotations(false)">
                <v-list-item-title>Export Annotations (eaf)</v-list-item-title>
              </v-list-item>
              <v-list-item @click="exportAnnotations(true)">
                <v-list-item-title>Export Annotations (csv)</v-list-item-title>
              </v-list-item>
              <v-list-item @click="exportScreenshotsDialog = true">
                <v-list-item-title>Export Screenshots</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-list-item>
        <v-list-item>
          <v-list-item-title>Layout</v-list-item-title>
          <template #append>
            <v-icon icon="mdi-menu-right" size="x-small"></v-icon>
          </template>
          <v-menu :open-on-focus="false" activator="parent" open-on-hover submenu>
            <v-list>
              <v-list-item @click="layout = 'tibava'">
                <v-list-item-title>TIBAVA</v-list-item-title>
              </v-list-item>
              <v-list-item @click="layout = 'draggable'">
                <v-list-item-title>Draggable</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-btn v-tooltip="'Home'" icon @click="homeClicked">
      <v-icon>mdi-home</v-icon>
    </v-btn>
  </v-app-bar>
  <v-main class="ma-3">
    <layout-tibava v-if="layout === 'tibava'"></layout-tibava>
    <layout-draggable v-else-if="layout === 'draggable'"></layout-draggable>
    <v-dialog v-model="genScreenshotDialog" persistent max-width="400">
      <v-card>
        <v-card-title>Generate Screenshots</v-card-title>
        <v-card-text>
          Create a screenshot every N seconds
          <v-text-field
            v-model="screenshotInterval"
            label="N"
            type="number"
            min="1"
            max="100"
          ></v-text-field>
          <v-checkbox
            v-model="screenshotPerShot"
            label="Ensure at least one screenshot per frame"
          ></v-checkbox>
          <v-select
            v-if="screenshotPerShot"
            v-model="screenshotShotTimeline"
            :items="undoableStore.shotTimelines"
            label="Shot Timeline"
            item-title="name"
            item-value="id"
          >
          </v-select>
        </v-card-text>
        <v-card-actions>
          <v-btn color="warning" @click="genScreenshotDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="genScreenshotButtonDisabled"
            @click="generateScreenshots"
            >Generate</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="exportScreenshotsDialog" persistent max-width="500">
      <v-card>
        <v-card-title>Export Screenshots</v-card-title>
        <v-card-text>
          You can either export all screenshots at once or select them individually in a timeline
          and only export those.
        </v-card-text>
        <v-card-actions>
          <v-btn color="warning" @click="exportScreenshotsDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="exportScreenshots(false)">Export all</v-btn>
          <v-btn
            color="secondary"
            :disabled="exportScreenshotsIndividualDisabled"
            @click="exportScreenshots(true)"
            >Export individually</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-main>
</template>

<script>
import { mapStores } from 'pinia'

import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'
import { useUndoStore } from '@renderer/stores/undo'
import { api } from '@renderer/api'
import LayoutTibava from '@renderer/components/LayoutTibava.vue'
import LayoutDraggable from '@renderer/components/LayoutDraggable.vue'

export default {
  components: { LayoutTibava, LayoutDraggable },
  data: () => ({
    layout: 'tibava',
    genScreenshotDialog: false,
    screenshotPerShot: false,
    screenshotInterval: 10,
    screenshotShotTimeline: undefined,
    exportScreenshotsDialog: false
  }),
  computed: {
    ...mapStores(useMainStore),
    ...mapStores(useTempStore),
    ...mapStores(useUndoableStore),
    ...mapStores(useUndoStore),
    runningJobs() {
      return Object.values(this.tempStore.jobs).some((j) => j.status === 'RUNNING')
    },
    hasJobs() {
      return Object.keys(this.tempStore.jobs).length > 0
    },
    isUndoable() {
      return this.undoStore.isUndoable('undoable')
    },
    isRedoable() {
      return this.undoStore.isRedoable('undoable')
    },
    genScreenshotButtonDisabled() {
      return this.screenshotPerShot && this.screenshotShotTimeline === undefined
    },
    exportScreenshotsIndividualDisabled() {
      if (this.tempStore.selectedSegments.size == 0) return true
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      const segment = this.undoableStore.getSegmentForId(timelineid, shotid)
      return segment.image === undefined
    }
  },
  created() {
    this.mainStore.loadStore(this.$route.params.id)
    this.undoableStore.loadStore(this.$route.params.id)
  },
  methods: {
    homeClicked() {
      this.$router.push('/')
      this.mainStore.reset()
      this.tempStore.reset()
      this.undoableStore.reset()
      this.undoStore.reset()
    },
    undo() {
      this.undoableStore.undo('undoable')
    },
    redo() {
      this.undoableStore.redo('undoable')
    },
    shotBoundaryDetectionClicked() {
      this.undoableStore.runShotBoundaryDetection()
    },
    loadSubtitles() {
      this.undoableStore.loadSubtitles()
    },
    exportScreenshots(individually) {
      if (individually) {
        const frames = Array.from(this.tempStore.selectedSegments.entries()).map(
          (shotinfo) => this.undoableStore.getSegmentForId(shotinfo[1], shotinfo[0]).frame
        )
        api.exportScreenshots(this.mainStore.id, frames)
      } else {
        api.exportScreenshots(this.mainStore.id)
      }
      this.exportScreenshotsDialog = false
    },
    generateScreenshots() {
      this.genScreenshotDialog = false
      let frames = []
      let shotI = 0
      let timelineShots
      if (this.screenshotPerShot) {
        timelineShots = this.undoableStore.shotTimelines.filter(
          (t) => t.id === this.screenshotShotTimeline
        )[0].data
      }

      for (let i = 0; i <= this.mainStore.videoDuration; i++) {
        if (i % this.screenshotInterval == 0) {
          const frame = Math.floor(i * this.mainStore.fps)

          while (
            this.screenshotPerShot &&
            shotI < timelineShots.length &&
            frame >= timelineShots[shotI].start
          ) {
            if (frame > timelineShots[shotI].end) {
              frames.push(
                Math.round(
                  timelineShots[shotI].start +
                    (timelineShots[shotI].end - timelineShots[shotI].start) / 2
                )
              )
            }
            shotI++
          }
          frames.push(frame)
        }
      }
      this.undoableStore.generateScreenshots(frames)
    },
    importAnnotations() {
      this.undoableStore.importAnnotations()
    },
    exportAnnotations(csv) {
      api().exportAnnotations(this.mainStore.id, csv)
    },
    statusToColor(status) {
      if (status === 'RUNNING') return 'yellow'
      else if (status === 'ERROR') return 'error'
      else if (status === 'DONE') return 'success'
      else if (status === 'CANCELED') return 'black'
      else return 'white'
    }
  }
}
</script>
