<template>
  <v-main>
    <v-container class="fill-height flex-column">
      <v-row justify="center">
        <v-col align-self="center">
          <p class="text-h1">VIAN light</p>
        </v-col>
      </v-row>
      <v-row justify="center">
        <v-col align-self="center">
          <v-btn @click="openVideo">Open video</v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<script>
import { mapStores } from 'pinia'

import { useMainStore } from '@renderer/stores/main'

export default {
  computed: {
    ...mapStores(useMainStore)
  },
  methods: {
    async openVideo() {
      const video = await this.mainStore.open_video()
      if (video !== undefined) this.$router.push({ path: '/videoanalysis' })
    }
  }
}
</script>
