<template>
  <v-sheet>
    <video
      ref="video"
      class="ma-2"
      crossorigin="anonymous"
      @durationchange="durationChange"
      @timeupdate="videoTimeUpdate"
    >
      <source v-if="mainStore.video !== null" :src="mainStore.video" type="video/mp4" />

      <track
        v-if="undoableStore.subtitles !== null"
        kind="subtitles"
        :src="undoableStore.subtitles"
        default
      />
    </video>

    <div class="d-flex flex-column">
      <div class="d-flex justify-space-between ma-2 min-wide-control">
        <div class="align-center d-flex">
          <v-btn icon @click="jumpBackward">
            <v-icon>mdi-skip-backward</v-icon>
          </v-btn>

          <v-btn icon @click="backwardClicked">
            <v-icon>mdi-step-backward</v-icon>
          </v-btn>

          <v-btn icon @click="playPauseClicked">
            <v-icon v-if="playingState">mdi-pause</v-icon>

            <v-icon v-else>mdi-play</v-icon>
          </v-btn>

          <v-btn icon @click="forwardClicked">
            <v-icon>mdi-step-forward</v-icon>
          </v-btn>

          <v-btn icon @click="jumpForward">
            <v-icon>mdi-skip-forward</v-icon>
          </v-btn>

          <v-chip
            v-tooltip="{
              text: 'Playback Rate (JKL System)\n\nJ: Play backward (2x, 4x, 8x, 16x)\nK: Stop\nL: Play forward (2x, 4x, 8x, 16x)\n\nPress multiple times to increase speed',
              location: 'top'
            }"
            class="playback-rate"
            variant="text"
          >
            {{ playbackRate }}x
          </v-chip>

          <p>{{ readableTime }}</p>
        </div>

        <div class="align-center d-flex">
          <v-btn v-if="pictureInPictureEnabled" icon @click="pictureInPictureClicked">
            <v-icon>mdi-picture-in-picture-top-right</v-icon>
          </v-btn>

          <v-btn icon @click="screenshotClicked">
            <v-icon>mdi-camera</v-icon>
          </v-btn>

          <div class="volume-control">
            <v-btn icon @click="toggleVolumeSlider" @dblclick="toggleMute">
              <v-icon>{{ volume === 0 ? 'mdi-volume-mute' : 'mdi-volume-high' }}</v-icon>
            </v-btn>

            <div v-if="showVolumeSlider" class="volume-slider-container" @click.stop>
              <div
                class="volume-slider"
                @mousedown="startVolumeDrag"
                @mousemove="updateVolumeDrag"
                @mouseup="stopVolumeDrag"
                @mouseleave="stopVolumeDrag"
              >
                <div class="volume-track">
                  <div class="volume-fill" :style="{ height: volume + '%' }"></div>
                </div>

                <div class="volume-thumb" :style="{ bottom: volume + '%' }"></div>
              </div>
            </div>
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
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

const createLastKeyPress = () => ({
  count: 0,
  key: null,
  timestamp: 0
})

export default {
  name: 'VideoPlayer',

  data() {
    return {
      backwardInterval: null,
      isDragging: false,
      lastKeyPress: createLastKeyPress(),
      lastVolume: 50,
      playbackRate: 1,
      playingState: false,
      showVolumeSlider: false,
      sliderPosition: 0,
      volume: 50
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
    '$refs.video': {
      immediate: true,

      handler(video) {
        if (video) {
          video.volume = this.volume / 100
        }
      }
    },

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
    // Register event handlers directly
    api.onTogglePlayback(this.playPauseClicked)
    api.onFrameForward(this.forwardClicked)
    api.onFrameBackward(this.backwardClicked)
    api.onPlaybackForward(this.playForward)
    api.onPlaybackBackward(this.playBackward)
    api.onStopPlayback(this.stopPlayback)
    api.onSegmentPrevious(this.navigateToPreviousSegment)
    api.onSegmentNext(this.navigateToNextSegment)

    // Add click outside handler for volume slider
    document.addEventListener('click', this.handleClickOutside)

    // Set initial volume
    if (this.$refs.video) {
      this.$refs.video.volume = this.volume / 100
    }
  },

  beforeUnmount() {
    // Remove click outside handler
    document.removeEventListener('click', this.handleClickOutside)
  },

  methods: {
    backwardClicked() {
      if (this.$refs.video) {
        this.$refs.video.currentTime -= 1 / this.mainStore.fps
      }
    },

    durationChange(event) {
      this.mainStore.videoDuration = event.target.duration
    },

    forwardClicked() {
      if (this.$refs.video) {
        this.$refs.video.currentTime += 1 / this.mainStore.fps
      }
    },

    handleClickOutside(event) {
      if (!event.target.closest('.volume-control')) {
        this.showVolumeSlider = false
      }
    },

    jumpBackward() {
      if (this.$refs.video) {
        this.$refs.video.currentTime = Math.max(0, this.$refs.video.currentTime - 5)
      }
    },

    jumpForward() {
      if (this.$refs.video) {
        this.$refs.video.currentTime = Math.min(
          this.$refs.video.duration,
          this.$refs.video.currentTime + 5
        )
      }
    },

    muteClicked() {
      this.$refs.video.muted = !this.tempStore.muted
      this.tempStore.muted = !this.tempStore.muted
      if (this.tempStore.muted) {
        this.volume = 0
      } else {
        this.volume = 100
      }
    },

    navigateToNextSegment() {
      const currentTime = this.$refs.video.currentTime * this.mainStore.fps

      // Get the currently selected timeline
      const selectedTimelineId =
        this.tempStore.selectedSegments.size > 0
          ? this.tempStore.selectedSegments.values().next().value
          : this.undoableStore.shotTimelines[0]?.id

      if (!selectedTimelineId) return

      const timeline = this.undoableStore.timelines.find((t) => t.id === selectedTimelineId)
      if (!timeline || timeline.type !== 'shots') return

      // Filter out invalid segments (those without start/end)
      const segments = timeline.data.filter(
        (s) =>
          Object.hasOwn(s, 'start') &&
          typeof s.start === 'number' &&
          s.start >= 0 &&
          Object.hasOwn(s, 'end') &&
          typeof s.end === 'number' &&
          s.end >= 0
      )
      if (segments.length === 0) return

      // First try to find the currently selected segment's index
      let currentSegmentId = null
      if (this.tempStore.selectedSegments.size > 0) {
        currentSegmentId = Array.from(this.tempStore.selectedSegments.keys())[0]
      }

      let nextSegment = null
      if (currentSegmentId) {
        // If we have a selected segment, find its index and get the next one
        const currentIndex = segments.findIndex((s) => s.id === currentSegmentId)
        if (currentIndex !== -1 && currentIndex < segments.length - 1) {
          nextSegment = segments[currentIndex + 1]
        } else if (currentIndex === segments.length - 1) {
          // If we're at the last segment, loop back to the first one
          nextSegment = segments[0]
        }
      }

      if (nextSegment) {
        // Navigate to the found segment
        this.$refs.video.currentTime = nextSegment.start / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[nextSegment.id, timeline.id]])
      } else {
        const nextIndex = segments.findIndex((segment) => segment.start > currentTime)
        if (nextIndex === -1) {
          // If no segment after current time, loop back to first segment
          nextSegment = segments[0]
        } else {
          nextSegment = segments[nextIndex]
        }
        // Jump to the found segment
        if (nextSegment) {
          this.$refs.video.currentTime = nextSegment.start / this.mainStore.fps
          this.tempStore.selectedSegments = new Map([[nextSegment.id, timeline.id]])
        }
      }
    },

    navigateToPreviousSegment() {
      const currentTime = this.$refs.video.currentTime * this.mainStore.fps

      // Get the currently selected timeline
      const selectedTimelineId =
        this.tempStore.selectedSegments.size > 0
          ? this.tempStore.selectedSegments.values().next().value
          : this.undoableStore.shotTimelines[0]?.id

      if (!selectedTimelineId) return

      const timeline = this.undoableStore.timelines.find((t) => t.id === selectedTimelineId)
      if (!timeline || timeline.type !== 'shots') return

      // Filter out invalid segments (those without start/end)
      const segments = timeline.data.filter(
        (s) =>
          Object.hasOwn(s, 'start') &&
          typeof s.start === 'number' &&
          s.start >= 0 &&
          Object.hasOwn(s, 'end') &&
          typeof s.end === 'number' &&
          s.end >= 0
      )
      if (segments.length === 0) return

      // First try to find the currently selected segment's index
      let currentSegmentId = null
      if (this.tempStore.selectedSegments.size > 0) {
        currentSegmentId = Array.from(this.tempStore.selectedSegments.keys())[0]
      }

      let prevSegment = null
      if (currentSegmentId) {
        // If we have a selected segment, find its index and get the previous one
        const currentIndex = segments.findIndex((s) => s.id === currentSegmentId)
        if (currentIndex > 0) {
          prevSegment = segments[currentIndex - 1]
        } else if (currentIndex === 0) {
          // If we're at the first segment, loop to the last one
          prevSegment = segments[segments.length - 1]
        }
      }

      // If we don't have a selected segment or couldn't find previous from selection,
      // find the last segment that starts before current time
      if (!prevSegment) {
        const currentIndex = segments.findIndex((segment) => segment.start > currentTime) - 1
        if (currentIndex >= 0) {
          prevSegment = segments[currentIndex]
        } else {
          // If no segment before current time, go to last segment
          prevSegment = segments[segments.length - 1]
        }
      }

      // Navigate to the found segment
      if (prevSegment) {
        this.$refs.video.currentTime = prevSegment.start / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[prevSegment.id, timeline.id]])
      }
    },

    pictureInPictureClicked() {
      this.$refs.video.requestPictureInPicture()
    },

    playBackward() {
      if (this.$refs.video) {
        this.$refs.video.playbackRate = -this.playbackRate
        this.$refs.video.play()
      }
    },

    playForward() {
      if (this.$refs.video) {
        this.$refs.video.playbackRate = this.playbackRate
        this.$refs.video.play()
      }
    },

    playPauseClicked() {
      if (this.playingState) {
        this.$refs.video.pause()
        this.playingState = false
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
      if (this.$refs.video) {
        this.$refs.video.currentTime = value
      }
    },

    startVolumeDrag(event) {
      this.isDragging = true
      this.updateVolumeFromEvent(event)
    },

    stopPlayback() {
      if (this.$refs.video) {
        this.$refs.video.pause()
        this.playingState = false
      }
    },

    stopVolumeDrag() {
      this.isDragging = false
    },

    toggleMute() {
      if (this.volume === 0) {
        this.volume = this.lastVolume
      } else {
        this.lastVolume = this.volume
        this.volume = 0
      }
      this.$refs.video.volume = this.volume / 100
    },

    toggleSubtitles() {
      this.undoableStore.subtitlesVisible = !this.undoableStore.subtitlesVisible
    },

    toggleVolumeSlider() {
      this.showVolumeSlider = !this.showVolumeSlider
    },

    updateVolumeDrag(event) {
      if (this.isDragging) {
        this.updateVolumeFromEvent(event)
      }
    },

    updateVolumeFromEvent(event) {
      const rect = event.currentTarget.getBoundingClientRect()
      const y = rect.bottom - event.clientY
      const percentage = (y / rect.height) * 100
      this.volume = Math.max(0, Math.min(100, percentage))
      this.$refs.video.volume = this.volume / 100
    },

    videoTimeUpdate() {
      if (this.$refs.video) {
        this.sliderPosition = this.$refs.video.currentTime
        this.tempStore.playPosition = this.$refs.video.currentTime
      }
    }
  }
}
</script>

<style scoped>
video {
  max-width: calc(100% - 20px);
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
.volume-slider-container {
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  height: 120px;
  margin-bottom: 8px;
  background: white;
  padding: 12px 8px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  align-items: center;
}
.volume-slider {
  position: relative;
  height: 100px;
  width: 20px;
  cursor: pointer;
  margin: 0 auto;
}
.volume-track {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 100%;
  background: #e0e0e0;
  border-radius: 2px;
}
.volume-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: rgb(var(--v-theme-primary));
  border-radius: 2px;
}
.volume-thumb {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: rgb(var(--v-theme-primary));
  border-radius: 50%;
  cursor: grab;
  margin-top: -6px; /* Center the thumb on the track */
}
.volume-thumb:active {
  cursor: grabbing;
}
</style>
