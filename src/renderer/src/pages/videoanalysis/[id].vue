<template>
  <v-app-bar density="compact">
    <v-app-bar-title
      >VIAN Light
      <span class="text-body-2 text-medium-emphasis">{{ mainStore.video }}</span></v-app-bar-title
    >

    <v-btn v-tooltip="'Undo'" :disabled="!isUndoable" icon @click="undo">
      <v-icon>mdi-undo</v-icon>
    </v-btn>

    <v-btn v-tooltip="'Redo'" :disabled="!isRedoable" icon @click="redo">
      <v-icon>mdi-redo</v-icon>
    </v-btn>

    <v-menu :close-on-content-click="false">
      <template #activator="{ props }">
        <v-btn v-tooltip="'Job list'" :disabled="!hasJobs" icon v-bind="props">
          <v-badge v-if="runningJobs" color="error" dot>
            <v-icon>mdi-history</v-icon>
          </v-badge>

          <v-icon v-else>mdi-history</v-icon>
        </v-btn>
      </template>

      <v-list>
        <v-list-item v-for="(job, i) in tempStore.jobs" :key="i">
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

    <v-btn v-tooltip="'Home'" icon @click="homeClicked">
      <v-icon>mdi-home</v-icon>
    </v-btn>
  </v-app-bar>

  <v-navigation-drawer
    v-model:rail="drawerRail"
    permanent
    location="right"
    width="325"
    expand-on-hover
  >
    <v-list v-model:opened="drawerGroupsOpen" density="compact" nav>
      <v-list-item
        prepend-icon="mdi-movie-open"
        title="Shot Boundary Detection"
        @click="shotBoundaryDetectionClicked"
      ></v-list-item>

      <v-list-item
        title="Load Subtitles"
        prepend-icon="mdi-microphone-message"
        @click="loadSubtitles"
      ></v-list-item>

      <v-list-item
        prepend-icon="mdi-image-plus"
        title="Generate Screenshots"
        @click="genScreenshotDialog = true"
      ></v-list-item>

      <v-divider class="my-5"></v-divider>

      <v-list-item
        prepend-icon="mdi-playlist-edit"
        title="Manage Vocabulary"
        @click="manageVocabulary"
      ></v-list-item>

      <v-list-group>
        <template #activator="{ props }">
          <v-list-item v-bind="props" prepend-icon="mdi-import" title="Import Data" />
        </template>

        <v-list-item
          prepend-icon="mdi-alpha-e-box"
          title="Import ELAN Annotations (.eaf)"
          @click="importAnnotations(false)"
        />

        <v-list-item prepend-icon="mdi-alpha-t-box" title="Import TIB‑AV‑A Results (WiP)" />
      </v-list-group>

      <v-list-group>
        <template #activator="{ props }">
          <v-list-item v-bind="props" prepend-icon="mdi-export" title="Export Data" />
        </template>

        <v-list-item
          prepend-icon="mdi-alpha-e-box"
          title="Export as ELAN Annotations (.eaf)"
          @click="exportAnnotations(false)"
        />

        <v-list-item
          prepend-icon="mdi-file-delimited"
          title="Export Annotations as .csv"
          @click="exportAnnotations(true)"
        />

        <v-list-item
          prepend-icon="mdi-image-move"
          title="Export Screenshots"
          @click="exportScreenshotsDialog = true"
        />

        <v-list-item
          prepend-icon="mdi-folder-zip"
          title="Export Project as .zip"
          @click="exportProject"
        />
      </v-list-group>

      <v-divider class="my-5"></v-divider>

      <v-list-item
        v-if="darkMode"
        prepend-icon="mdi-weather-sunny"
        title="Switch to Light Mode"
        @click="switchLightMode"
      ></v-list-item>

      <v-list-item
        v-else
        prepend-icon="mdi-weather-night"
        title="Switch to Dark Mode"
        @click="switchLightMode"
      ></v-list-item>

      <v-list-group>
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            prepend-icon="mdi-arrow-expand-all"
            title="Layout"
          ></v-list-item>
        </template>

        <v-list-item
          prepend-icon="mdi-alpha-e-box"
          title="Tabbed Layout"
          @click="layout = 'tibava'"
        >
        </v-list-item>

        <v-list-item
          prepend-icon="mdi-move-resize"
          title="Draggable Layout"
          @click="layout = 'draggable'"
        >
        </v-list-item>
      </v-list-group>
    </v-list>
  </v-navigation-drawer>

  <v-main id="main-content" class="ma-3">
    <LayoutTibava v-if="layout === 'tibava'"></LayoutTibava>

    <LayoutDraggable v-else-if="layout === 'draggable'"></LayoutDraggable>

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
            label="Ensure at least one screenshot per shot"
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

    <VocabularyDialog ref="vocabularyDialog"></VocabularyDialog>
  </v-main>
</template>

<script>
import { mapStores } from 'pinia'

import LayoutDraggable from '@renderer/components/LayoutDraggable.vue'
import LayoutTibava from '@renderer/components/LayoutTibava.vue'
import VocabularyDialog from '@renderer/components/VocabularyDialog.vue'
import api from '@renderer/api'
import { exportAnnotations } from '@renderer/importexport'
import shortcuts from '@renderer/shortcuts'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoStore } from '@renderer/stores/undo'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'Id',
  components: { LayoutDraggable, LayoutTibava, VocabularyDialog },

  data: () => ({
    drawerGroupsOpen: [],
    drawerRail: true,
    exportScreenshotsDialog: false,
    genScreenshotDialog: false,
    layout: 'tibava',
    screenshotInterval: 10,
    screenshotPerShot: false,
    screenshotShotTimeline: null
  }),

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore, useUndoStore),

    darkMode() {
      return this.$vuetify.theme.global.name === 'dark'
    },

    exportScreenshotsIndividualDisabled() {
      if (this.tempStore.selectedSegments.size === 0) return true
      const [shotid, timelineid] = this.tempStore.selectedSegments.entries().next().value
      const segment = this.undoableStore.getSegmentForId(timelineid, shotid)
      return !('image' in segment)
    },

    genScreenshotButtonDisabled() {
      return this.screenshotPerShot && this.screenshotShotTimeline === null
    },

    hasJobs() {
      return this.tempStore.jobs.length > 0
    },

    isRedoable() {
      return this.undoStore.isRedoable('undoable')
    },

    isUndoable() {
      return this.undoStore.isUndoable('undoable')
    },

    runningJobs() {
      return this.tempStore.jobs.some((j) => j.status === 'RUNNING')
    }
  },

  watch: {
    drawerRail(newVal) {
      if (newVal) {
        this.drawerGroupsOpen = []
      }
    }
  },

  created() {
    this.mainStore.loadStore(this.$route.params.id)
    this.undoableStore.loadStore(this.$route.params.id)

    // Register shortcuts / menu bar actions
    api.onUndoAction(() => {
      useUndoableStore().undo('undoable')
    })
    api.onRedoAction(() => {
      useUndoableStore().redo('undoable')
    })
    shortcuts.register(
      'z',
      () => {
        useUndoableStore().undo('undoable')
      },
      false,
      true
    )
    shortcuts.register(
      'z',
      () => {
        useUndoableStore().undo('undoable')
      },
      false,
      false,
      true
    )
    shortcuts.register(
      'z',
      () => {
        useUndoableStore().redo('undoable')
      },
      true,
      true
    )
    shortcuts.register(
      'z',
      () => {
        useUndoableStore().redo('undoable')
      },
      true,
      false,
      true
    )
  },

  beforeUnmount() {
    shortcuts.clear('z', false, true)
    shortcuts.clear('z', true, true)
    shortcuts.clear('z', true, false, true)
    shortcuts.clear('z', true, false, true)
    api.unregisterVideoViewCallbacks()
  },

  methods: {
    exportAnnotations(csv) {
      exportAnnotations(csv)
    },

    exportProject() {
      api.exportProject(this.mainStore.id)
    },

    exportScreenshots(individually) {
      if (individually) {
        const frames = Array.from(this.tempStore.selectedSegments).map(
          ([shotid, timelineid]) => this.undoableStore.getSegmentForId(timelineid, shotid).frame
        )
        api.exportScreenshots(this.mainStore.id, frames)
      } else {
        api.exportScreenshots(this.mainStore.id, null)
      }
      this.exportScreenshotsDialog = false
    },

    generateScreenshots() {
      this.genScreenshotDialog = false
      const frames = []
      let shotI = 0
      const timelineShots = this.screenshotPerShot
        ? this.undoableStore.shotTimelines.find((t) => t.id === this.screenshotShotTimeline).data
        : []

      for (let i = 0; i <= this.mainStore.videoDuration; i += 1) {
        if (i % this.screenshotInterval === 0) {
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
            shotI += 1
          }
          frames.push(frame)
        }
      }
      this.undoableStore.generateScreenshots(frames)
    },

    homeClicked() {
      this.$router.push('/')
      this.mainStore.$reset()
      this.tempStore.$reset()
      this.undoableStore.$reset()
      this.undoStore.reset()
    },

    importAnnotations() {
      this.undoableStore.importAnnotations()
    },

    loadSubtitles() {
      this.undoableStore.loadSubtitles()
    },

    manageVocabulary() {
      this.$refs.vocabularyDialog.show()
    },

    redo() {
      this.undoableStore.redo('undoable')
    },

    shotBoundaryDetectionClicked() {
      this.undoableStore.runShotBoundaryDetection()
    },

    statusToColor(status) {
      if (status === 'RUNNING') return 'yellow'
      else if (status === 'ERROR') return 'error'
      else if (status === 'DONE') return 'success'
      else if (status === 'CANCELED') return 'black'
      return 'white'
    },

    switchLightMode() {
      const theme = this.$vuetify.theme.global.name
      if (theme === 'dark') {
        this.$vuetify.theme.global.name = 'light'
      } else {
        this.$vuetify.theme.global.name = 'dark'
      }
    },

    undo() {
      this.undoableStore.undo('undoable')
    }
  }
}
</script>

<style scoped>
#main-content {
  padding-right: 60px !important;
}
</style>
