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

export default {
  created() {
    useMainStore().initialize()
    useUndoableStore().initialize()
    useMetaStore().initialize()
    useTempStore().initialize()

    // necessary in electron to show first page of Vue
    this.$router.push('/')
  }
}
</script>
