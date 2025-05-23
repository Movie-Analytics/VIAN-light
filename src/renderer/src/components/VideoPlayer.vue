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
      <div class="ma-2 min-wide-control d-flex justify-space-between">
        <div class="d-flex align-center">
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
          <v-btn icon disabled class="playback-rate">
            {{ playbackRate }}x
          </v-btn>
          <span class="time-display">{{ readableTime }}</span>
        </div>

        <div class="d-flex align-center">
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
        :step="0.1"
        hide-details="true"
        class="px-2"
        @update:model-value="sliderMoved"
      ></v-slider>
    </div>
  </v-sheet>
</template>

<script>
import { mapStores } from 'pinia'

import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'VideoPlayer',

  data() {
    return {
      playingState: false,
      sliderPosition: 0,
      playbackRate: 1,
      backwardInterval: null,
      lastKeyPress: {
        key: null,
        timestamp: 0,
        count: 0
      },
      showVolumeSlider: false,
      volume: 100,
      isDragging: false,
      lastVolume: 100
    }
  },

  computed: {
    pictureInPictureEnabled() {
      return document.pictureInPictureEnabled
    },

    readableTime() {
      const currentTime = this.mainStore.timeReadableSec(this.tempStore.playPosition)
      const totalTime = this.mainStore.timeReadableSec(this.mainStore.videoDuration)
      return `${currentTime} / ${totalTime}`
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
    // Listen for global shortcuts
    window.electronAPI.ipcRenderer.on('toggle-playback', this.playPauseClicked)
    window.electronAPI.ipcRenderer.on('frame-forward', this.forwardClicked)
    window.electronAPI.ipcRenderer.on('frame-backward', this.backwardClicked)
    window.electronAPI.ipcRenderer.on('playback-forward', this.playForward)
    window.electronAPI.ipcRenderer.on('playback-backward', this.playBackward)
    window.electronAPI.ipcRenderer.on('stop-playback', this.stopPlayback)

    // Add click outside handler for volume slider
    document.addEventListener('click', this.handleClickOutside)
  },

  beforeUnmount() {
    // Clean up event listeners
    window.electronAPI.ipcRenderer.removeListener('toggle-playback', this.playPauseClicked)
    window.electronAPI.ipcRenderer.removeListener('frame-forward', this.forwardClicked)
    window.electronAPI.ipcRenderer.removeListener('frame-backward', this.backwardClicked)
    window.electronAPI.ipcRenderer.removeListener('playback-forward', this.playForward)
    window.electronAPI.ipcRenderer.removeListener('playback-backward', this.playBackward)
    window.electronAPI.ipcRenderer.removeListener('stop-playback', this.stopPlayback)

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

    muteClicked() {
      this.$refs.video.muted = !this.tempStore.muted
      this.tempStore.muted = !this.tempStore.muted
      if (this.tempStore.muted) {
        this.volume = 0
      } else {
        this.volume = 100
      }
    },

    pictureInPictureClicked() {
      this.$refs.video.requestPictureInPicture()
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

    sliderMoved(n) {
      this.$refs.video.currentTime = (this.$refs.video.duration / 100) * n
    },

    toggleSubtitles() {
      if (this.undoableStore.subtitlesVisible) this.$refs.video.textTracks[0].mode = 'hidden'
      else this.$refs.video.textTracks[0].mode = 'showing'

      this.undoableStore.subtitlesVisible = !this.undoableStore.subtitlesVisible
    },

    videoTimeUpdate(event) {
      this.tempStore.playPosition = event.target.currentTime
      this.sliderPosition = (event.target.currentTime / event.target.duration) * 100
    },

    playForward() {
      const now = Date.now()
      if (this.lastKeyPress.key === 'l' && now - this.lastKeyPress.timestamp < 1000) {
        this.lastKeyPress.count++
      } else {
        this.lastKeyPress.count = 1
      }
      this.lastKeyPress.key = 'l'
      this.lastKeyPress.timestamp = now

      // Calculate speed based on press count
      const speed = Math.min(Math.pow(2, this.lastKeyPress.count - 1), 16)
      this.playbackRate = speed
      this.$refs.video.playbackRate = this.playbackRate
      
      if (!this.playingState) {
        this.playPauseClicked()
      }
    },

    playBackward() {
      const now = Date.now()
      if (this.lastKeyPress.key === 'j' && now - this.lastKeyPress.timestamp < 1000) {
        this.lastKeyPress.count++
      } else {
        this.lastKeyPress.count = 1
      }
      this.lastKeyPress.key = 'j'
      this.lastKeyPress.timestamp = now

      // Calculate speed based on press count
      const speed = Math.min(Math.pow(2, this.lastKeyPress.count - 1), 16)
      
      // Clear any existing interval
      if (this.backwardInterval) {
        clearInterval(this.backwardInterval)
      }
      
      // Set up interval to update currentTime
      this.backwardInterval = setInterval(() => {
        if (this.$refs.video.currentTime > 0) {
          this.$refs.video.currentTime -= speed/30 // Move backward at calculated speed
        } else {
          this.stopPlayback()
        }
      }, 1000/60) // Update at 60fps
      
      if (!this.playingState) {
        this.playPauseClicked()
      }
    },

    stopPlayback() {
      this.$refs.video.pause()
      this.playingState = false
      this.playbackRate = 1
      this.$refs.video.playbackRate = 1
      if (this.backwardInterval) {
        clearInterval(this.backwardInterval)
        this.backwardInterval = null
      }
      // Reset key press tracking
      this.lastKeyPress = {
        key: null,
        timestamp: 0,
        count: 0
      }
    },

    handleClickOutside(event) {
      const volumeControl = this.$el.querySelector('.volume-control')
      if (volumeControl && !volumeControl.contains(event.target)) {
        this.showVolumeSlider = false
      }
    },

    toggleVolumeSlider(event) {
      event.stopPropagation()
      this.showVolumeSlider = !this.showVolumeSlider
    },

    startVolumeDrag(event) {
      this.isDragging = true
      this.updateVolumeFromEvent(event)
    },

    updateVolumeDrag(event) {
      if (this.isDragging) {
        this.updateVolumeFromEvent(event)
      }
    },

    stopVolumeDrag() {
      this.isDragging = false
    },

    updateVolumeFromEvent(event) {
      const slider = event.currentTarget
      const rect = slider.getBoundingClientRect()
      // Calculate position relative to the actual slider height (100px)
      const y = event.clientY - rect.top
      const percentage = Math.max(0, Math.min(100, 100 - (y / 100 * 100)))
      this.volume = Math.round(percentage)
      this.$refs.video.volume = this.volume / 100
    },

    toggleMute(event) {
      event.stopPropagation()
      if (this.volume === 0) {
        // Unmute: restore last volume
        this.volume = this.lastVolume
      } else {
        // Mute: save current volume and set to 0
        this.lastVolume = this.volume
        this.volume = 0
      }
      this.$refs.video.volume = this.volume / 100
    },

    jumpForward() {
      this.$refs.video.currentTime = Math.min(
        this.$refs.video.duration,
        this.$refs.video.currentTime + 5
      )
    },

    jumpBackward() {
      this.$refs.video.currentTime = Math.max(
        0,
        this.$refs.video.currentTime - 5
      )
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
.time-display {
  margin-left: 8px;
  font-family: monospace;
  font-size: 0.9em;
  line-height: 1;
  display: flex;
  align-items: center;
}
.playback-rate {
  font-family: monospace;
  font-size: 0.9em;
  min-width: 40px !important;
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
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
