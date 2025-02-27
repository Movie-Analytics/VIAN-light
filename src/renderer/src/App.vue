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
