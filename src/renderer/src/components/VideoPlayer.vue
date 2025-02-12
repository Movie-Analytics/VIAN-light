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
        style="min-width: 300px"
        class="px-2"
        @update:model-value="sliderMoved"
      ></v-slider>
      <div class="ma-2" style="min-width: 300px">
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
import { useUndoableStore } from '@renderer/stores/undoable'
import { useTempStore } from '@renderer/stores/temp'

export default {
  data() {
    return {
      playingState: false,
      sliderPosition: 0
    }
  },
  computed: {
    readableTime() {
      const currentTime = this.mainStore.timeReadableSec(this.tempStore.playPosition)
      const totalTime = this.mainStore.timeReadableSec(this.mainStore.videoDuration)
      return `${currentTime} / ${totalTime}`
    },
    pictureInPictureEnabled() {
      return document !== undefined && document.pictureInPictureEnabled
    },
    ...mapStores(useMainStore, useTempStore, useUndoableStore)
  },
  watch: {
    'tempStore.playJumpPosition'(newValue) {
      // use a proxy value because updating currentTime based on playPosition
      // directly is prone to timing issues
      if (newValue !== null) {
        this.$refs.video.currentTime = newValue
        this.tempStore.playJumpPosition = null
      }
    }
  },
  methods: {
    sliderMoved(n) {
      this.$refs.video.currentTime = (this.$refs.video.duration / 100) * n
    },
    forwardClicked() {
      this.$refs.video.currentTime += 1 / this.mainStore.fps
    },
    backwardClicked() {
      this.$refs.video.currentTime -= 1 / this.mainStore.fps
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
    pictureInPictureClicked() {
      this.$refs.video.requestPictureInPicture()
    },
    videoTimeUpdate(event) {
      this.tempStore.playPosition = event.target.currentTime
      this.sliderPosition = (event.target.currentTime / event.target.duration) * 100
    },
    durationChange(event) {
      this.mainStore.videoDuration = event.target.duration
    },
    toggleSubtitles() {
      if (this.undoableStore.subtitlesVisible) this.$refs.video.textTracks[0].mode = 'hidden'
      else this.$refs.video.textTracks[0].mode = 'showing'

      this.undoableStore.subtitlesVisible = !this.undoableStore.subtitlesVisible
    },
    screenshotClicked() {
      this.undoableStore.generateScreenshot(
        Math.floor(this.$refs.video.currentTime * this.mainStore.fps)
      )
    },
    muteClicked() {
      this.$refs.video.muted = !this.tempStore.muted
      this.tempStore.muted = !this.tempStore.muted
    }
  }
}
</script>
<style scoped>
video {
  max-width: calc(100% - 20px);
}
</style>
