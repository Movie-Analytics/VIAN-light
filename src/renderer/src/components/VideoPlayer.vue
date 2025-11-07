<template>
  <v-sheet class="d-flex flex-column h-100 w-100">
    <video
      ref="video"
      class="flex-1-1 height-min-0 pa-2"
      crossorigin="anonymous"
      @durationchange="durationChange"
      @timeupdate="videoTimeUpdate"
    >
      <source v-if="mainStore.video !== null" :src="mainStore.video" type="video/mp4" />

      <track
        v-if="undoableStore.subtitles !== null && undoableStore.subtitlesVisible"
        kind="subtitles"
        :src="undoableStore.subtitles"
        default
      />
    </video>

    <div class="d-flex flex-0-0 flex-column">
      <div class="d-flex justify-space-between min-wide-control px-2">
        <div class="align-center d-flex">
          <v-btn density="comfortable" size="small" icon @click="jumpBackward">
            <v-icon>mdi-skip-backward</v-icon>
          </v-btn>

          <v-btn density="comfortable" size="small" icon @click="backwardClicked">
            <v-icon>mdi-step-backward</v-icon>
          </v-btn>

          <v-btn density="comfortable" size="small" icon @click="playPauseClicked">
            <v-icon v-if="playingState">mdi-pause</v-icon>

            <v-icon v-else>mdi-play</v-icon>
          </v-btn>

          <v-btn density="comfortable" size="small" icon @click="forwardClicked">
            <v-icon>mdi-step-forward</v-icon>
          </v-btn>

          <v-btn density="comfortable" size="small" icon @click="jumpForward">
            <v-icon>mdi-skip-forward</v-icon>
          </v-btn>

          <v-chip
            v-tooltip="{
              text: 'Playback Rate (KL System)\n\nK: Stop\nL: Play forward (2x, 4x, 8x, 16x)\n\nPress multiple times to increase speed',
              location: 'top'
            }"
            class="playback-rate"
            variant="text"
          >
            {{ playbackRate }}x
          </v-chip>

          <v-text>{{ readableTime }}</v-text>
        </div>

        <div class="align-center d-flex">
          <v-btn v-if="pictureInPictureEnabled" density="comfortable" size="small" icon @click="pictureInPictureClicked">
            <v-icon>mdi-picture-in-picture-top-right</v-icon>
          </v-btn>

          <v-btn density="comfortable" size="small" icon @click="screenshotClicked">
            <v-icon>mdi-camera</v-icon>
          </v-btn>

          <div class="volume-control">
            <v-btn density="comfortable" size="small" icon @click.stop="toggleVolumeSlider">
              <v-icon>{{ volume === 0 ? 'mdi-volume-mute' : 'mdi-volume-high' }}</v-icon>
            </v-btn>

            <v-menu
              v-model="showVolumeSlider"
              :close-on-content-click="false"
              location="top"
              offset="10"
            >
              <template #activator="{ props }">
                <div v-bind="props"></div>
              </template>

              <v-card min-width="50" class="overflow-hidden pa-2">
                <v-slider
                  v-model="volume"
                  direction="vertical"
                  :step="1"
                  :min="0"
                  :max="100"
                  height="50"
                  hide-details
                  @update:model-value="updateVolume"
                >
                </v-slider>
              </v-card>
            </v-menu>
          </div>

          <v-btn v-if="undoableStore.subtitles !== null" icon @click="toggleSubtitles">
            <v-icon v-if="undoableStore.subtitlesVisible">mdi-subtitles</v-icon>

            <v-icon v-else>mdi-subtitles-outline</v-icon>
          </v-btn>
        </div>
      </div>

      <v-slider
        v-model="sliderPosition"
        :max="mainStore.videoDuration"
        :step="0.1"
        hide-details="true"
        class="px-2"
        @update:model-value="sliderMoved"
      ></v-slider>
    </div>
  </v-sheet>
</template>

<script>
import api from '@renderer/api'
import { mapStores } from 'pinia'
import shortcuts from '@renderer/shortcuts'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'VideoPlayer',

  data() {
    return {
      playbackRate: 1,
      playingState: false,
      showVolumeSlider: false,
      sliderPosition: 0,
      volume: 100
    }
  },

  computed: {
    pictureInPictureEnabled() {
      return document.pictureInPictureEnabled
    },

    readableTime() {
      return this.mainStore.timeReadableSec(this.tempStore.playPosition)
    },

    ...mapStores(useMainStore, useTempStore, useUndoableStore)
  },

  watch: {
    'tempStore.playJumpPosition'(newValue) {
      // Use a proxy value because updating currentTime based on playPosition
      // directly is prone to timing issues
      if (newValue !== null) {
        this.$refs.video.currentTime = newValue
        this.tempStore.playJumpPosition = null
      }
    }
  },

  mounted() {
    // Register event handlers for menu buttons
    api.onTogglePlayback(this.playPauseClicked)
    api.onFrameForward(this.forwardClicked)
    api.onFrameBackward(this.backwardClicked)
    api.onPlaybackForward(this.playForward)
    api.onStopPlayback(this.stopPlayback)
    api.onSegmentPrevious(this.navigateToPreviousSegment)
    api.onSegmentNext(this.navigateToNextSegment)

    shortcuts.register(' ', this.playPauseClicked)
    shortcuts.register('ArrowRight', this.forwardClicked)
    shortcuts.register('ArrowLeft', this.backwardClicked)
    shortcuts.register('k', this.stopPlayback)
    shortcuts.register('l', this.playForward)
    shortcuts.register('ArrowUp', this.navigateToPreviousSegment)
    shortcuts.register('ArrowDown', this.navigateToNextSegment)
  },

  beforeUnmount() {
    for (const key of [' ', 'ArrowRight', 'ArrowLeft', 'j', 'k', 'l', 'a', 's']) {
      shortcuts.clear(key)
    }
  },

  methods: {
    backwardClicked() {
      this.$refs.video.currentTime -= 1 / this.mainStore.fps
    },

    durationChange(event) {
      this.mainStore.videoDuration = event.target.duration
    },

    forwardClicked() {
      this.$refs.video.currentTime += 1 / this.mainStore.fps
    },

    jumpBackward() {
      this.$refs.video.currentTime = Math.max(0, this.$refs.video.currentTime - 5)
    },

    jumpForward() {
      this.$refs.video.currentTime = Math.min(
        this.$refs.video.duration,
        this.$refs.video.currentTime + 5
      )
    },

    navigateToNextSegment() {
      const currentTime = Math.ceil(this.$refs.video.currentTime * this.mainStore.fps)

      if (this.tempStore.selectedSegments.size > 0) {
        const [selectedSegId, selectedTimelId] = this.tempStore.selectedSegments
          .entries()
          .next().value
        const timeline = this.undoableStore.timelines.find((t) => t.id === selectedTimelId)
        const segmentIndex = timeline.data.findIndex((s) => s.id === selectedSegId)
        const nextSegment = timeline.data[segmentIndex + 1] || timeline.data[0]
        this.$refs.video.currentTime = nextSegment.start / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[nextSegment.id, timeline.id]])
      } else if (this.undoableStore.shotTimelines.length > 0) {
        const timeline = this.undoableStore.shotTimelines[0]
        const segment = timeline.data.filter((s) => s.start > currentTime)[0] || timeline.data[0]
        this.$refs.video.currentTime = segment.start / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[segment.id, timeline.id]])
      }
    },

    navigateToPreviousSegment() {
      const currentTime = Math.floor(this.$refs.video.currentTime * this.mainStore.fps)

      if (this.tempStore.selectedSegments.size > 0) {
        const [selectedSegId, selectedTimelId] = this.tempStore.selectedSegments
          .entries()
          .next().value
        const timeline = this.undoableStore.timelines.find((t) => t.id === selectedTimelId)
        const segIndex = timeline.data.findIndex((s) => s.id === selectedSegId)
        const nextSegment = timeline.data[segIndex - 1] || timeline.data[timeline.data.length - 1]
        this.$refs.video.currentTime = nextSegment.start / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[nextSegment.id, timeline.id]])
      } else if (this.undoableStore.shotTimelines.length > 0) {
        const timeline = this.undoableStore.shotTimelines[0]
        const filtered = timeline.data.filter((s) => s.start < currentTime)
        const segment = filtered[filtered.length - 1] || timeline.data[timeline.data.length - 1]
        this.$refs.video.currentTime = segment.start / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[segment.id, timeline.id]])
      }
    },

    pictureInPictureClicked() {
      this.$refs.video.requestPictureInPicture()
    },

    playForward() {
      if (this.playbackRate === 16 || this.playingState === false) {
        this.playbackRate = 1
      } else {
        this.playbackRate = Math.min(16, this.playbackRate * 2)
      }
      this.$refs.video.playbackRate = this.playbackRate
      this.$refs.video.play()
      this.playingState = true
    },

    playPauseClicked() {
      if (this.playingState) {
        this.stopPlayback()
      } else {
        this.$refs.video.play()
        this.playingState = true
      }
    },

    screenshotClicked() {
      this.undoableStore.generateScreenshot(
        Math.floor(this.$refs.video.currentTime * this.mainStore.fps)
      )
    },

    sliderMoved(value) {
      this.$refs.video.currentTime = value
    },

    stopPlayback() {
      this.$refs.video.pause()
      this.playingState = false
      this.playbackRate = 1
      this.$refs.video.playbackRate = this.playbackRate
    },

    toggleSubtitles() {
      this.undoableStore.subtitlesVisible = !this.undoableStore.subtitlesVisible
    },

    toggleVolumeSlider(event) {
      // Don't show slider if it's a double click
      if (event?.detail === 2) return
      this.showVolumeSlider = !this.showVolumeSlider
    },

    updateVolume(value) {
      if (this.$refs.video) {
        this.$refs.video.volume = value / 100
      }
    },

    videoTimeUpdate(event) {
      this.tempStore.playPosition = event.target.currentTime
      this.sliderPosition = event.target.currentTime
    }
  }
}
</script>

<style scoped>
video {
  max-width: 100%;
  max-height: 100%;
}
.min-wide-control {
  min-width: 300px;
}
.playback-rate {
  font-family: monospace;
  font-size: 0.9em;
  min-width: 40px !important;
  opacity: 0.7;
  pointer-events: auto !important;
}
.volume-control {
  position: relative;
  display: flex;
  align-items: center;
}
.nav-icon:hover {
  color: red;
}
</style>
