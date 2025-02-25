<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script>
import { useMainStore } from '@renderer/stores/main'
import { useMetaStore } from '@renderer/stores/meta'
import { useUndoableStore } from '@renderer/stores/undoable'
import { useTempStore } from '@renderer/stores/temp'
import api from '@renderer/api'

export default {
  created() {
    useMainStore().initialize()
    useUndoableStore().initialize()
    useMetaStore().initialize()
    useTempStore().initialize()

    // eslint-disable-next-line
    if (isElectron) {
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
  }
}
</script>
