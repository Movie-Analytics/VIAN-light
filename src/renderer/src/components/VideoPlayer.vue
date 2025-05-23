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

    <div class="d-flex flex-wrap">
      <v-slider
        v-model="sliderPosition"
        :step="0.1"
        hide-details="true"
        class="min-wide-control px-2"
        @update:model-value="sliderMoved"
      ></v-slider>

      <div class="ma-2 min-wide-control">
        {{ readableTime }}
        <v-btn icon @click="backwardClicked">
          <v-icon>mdi-skip-backward</v-icon>
        </v-btn>

        <v-btn icon @click="playPauseClicked">
          <v-icon v-if="playingState">mdi-pause</v-icon>

          <v-icon v-else>mdi-play</v-icon>
        </v-btn>

        <v-btn icon @click="forwardClicked">
          <v-icon>mdi-skip-forward</v-icon>
        </v-btn>

        <v-btn v-if="pictureInPictureEnabled" icon @click="pictureInPictureClicked">
          <v-icon>mdi-picture-in-picture-top-right</v-icon>
        </v-btn>

        <v-btn icon @click="screenshotClicked">
          <v-icon>mdi-camera</v-icon>
        </v-btn>

        <v-btn icon @click="muteClicked">
          <v-icon v-if="tempStore.muted">mdi-volume-high</v-icon>

          <v-icon v-else>mdi-volume-mute</v-icon>
        </v-btn>

        <v-btn v-if="undoableStore.subtitles !== null" icon @click="toggleSubtitles">
          <v-icon v-if="undoableStore.subtitlesVisible">mdi-subtitles</v-icon>

          <v-icon v-else>mdi-subtitles-outline</v-icon>
        </v-btn>
      </div>
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
      }
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
  },

  beforeUnmount() {
    // Clean up event listeners
    window.electronAPI.ipcRenderer.removeListener('toggle-playback', this.playPauseClicked)
    window.electronAPI.ipcRenderer.removeListener('frame-forward', this.forwardClicked)
    window.electronAPI.ipcRenderer.removeListener('frame-backward', this.backwardClicked)
    window.electronAPI.ipcRenderer.removeListener('playback-forward', this.playForward)
    window.electronAPI.ipcRenderer.removeListener('playback-backward', this.playBackward)
    window.electronAPI.ipcRenderer.removeListener('stop-playback', this.stopPlayback)
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

    muteClicked() {
      this.$refs.video.muted = !this.tempStore.muted
      this.tempStore.muted = !this.tempStore.muted
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
.playback-speed {
  font-family: monospace;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  margin-left: 4px;
}
</style>
