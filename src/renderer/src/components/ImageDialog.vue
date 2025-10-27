<template>
  <v-dialog v-model="isOpen" max-height="90vh" max-width="90vw">
    <v-card :title="title">
      <v-card-text>
        <v-img :src="screenshot.image" contain max-height="60vh" />
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>

        <v-btn text="Close" @click="closeDialog"></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapStores } from 'pinia'
import { useMainStore } from '@renderer/stores/main'

export default {
  name: 'ImageDialog',

  data() {
    return {
      isOpen: false,
      screenshot: null
    }
  },

  computed: {
    ...mapStores(useMainStore),

    title() {
      return 'Screenshot at ' + this.mainStore.timeReadableFrame(this.screenshot.frame)
    }
  },

  methods: {
    closeDialog() {
      this.isOpen = false
    },

    show(screenshot) {
      this.screenshot = screenshot
      this.isOpen = true
    }
  }
}
</script>
