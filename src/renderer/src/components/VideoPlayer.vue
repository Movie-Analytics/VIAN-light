<template>
  <v-card>
    <video @timeupdate="videoTimeUpdate" class="ma-2" ref="video" crossorigin="anonymous">
      <source :src="mainStore.videoFileSrc" type="video/mp4" />
      <track
        v-if="mainStore.subtitleFileSrc !== undefined"
        kind="subtitles"
        :src="mainStore.subtitleFileSrc"
        default
      />
    </video>
    <div>
      <v-slider v-model="sliderPosition" @update:modelValue="sliderMoved" :step="0.1"></v-slider>
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
      <v-btn v-if="mainStore.subtitleFileSrc !== undefined" icon @click="toggleSubtitles">
        <v-icon v-if="subtitlesVisible">mdi-subtitles</v-icon>
        <v-icon v-else>mdi-subtitles-outline</v-icon>
      </v-btn>
    </div>
  </v-card>
</template>

<script>
import { mapStores } from 'pinia'

import { useMainStore } from '@renderer/stores/main'

export default {
  data() {
    return {
      playingState: false,
      time: 0,
      sliderPosition: 0,
      subtitlesVisible: true
    }
  },
  computed: {
    readableTime() {
      const totalSeconds = Math.round(this.time)
      const formattedMinutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
      const formattedSeconds = String(totalSeconds % 60).padStart(2, '0')
      return `${formattedMinutes}:${formattedSeconds}`
    },
    ...mapStores(useMainStore)
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
    videoTimeUpdate(event) {
      this.time = event.target.currentTime
      this.sliderPosition = (event.target.currentTime / event.target.duration) * 100
    },
    toggleSubtitles() {
      if (this.subtitlesVisible) this.$refs.video.textTracks[0].mode = 'hidden'
      else this.$refs.video.textTracks[0].mode = 'showing'

      this.subtitlesVisible = !this.subtitlesVisible
    }
  }
}
</script>
<style scoped>
video {
  max-width: calc(100% - 20px);
}
</style>
