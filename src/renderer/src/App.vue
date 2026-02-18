<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script>
import api from '@renderer/api'
import { useMainStore } from '@renderer/stores/main'
import { useMetaStore } from '@renderer/stores/meta'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'App',

  created() {
    useMainStore().initialize()
    useUndoableStore().initialize()
    useMetaStore().initialize()
    useTempStore().initialize()

    if (IS_ELECTRON) {
      this.$router.push('/')
    } else {
      this.$router.push('login')
      api.checkToken().then((success) => {
        if (success) {
          this.$router.push('/')
          api.intervalCheckToken()
        }
      })
    }

    window.addEventListener('error', (event) => {
      const errorMessage = event.error ? event.error.stack || event.error.message : event.message
      api.logError(`Renderer Error: ${errorMessage}`)
    })
    window.addEventListener('unhandledrejection', (event) => {
      api.logError(`Unhandled Promise Rejection: ${event.reason}`)
    })
  }
}
</script>
