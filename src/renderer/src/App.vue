<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script>
import { useMainStore } from '@renderer/stores/main'

export default {
  created() {
    useMainStore().initialize()

    // necessary in electron to show first page of Vue
    this.$router.push('/')
  }
}
</script>
