<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script>
export default {
  created() {
    // necessary in electron to show first page of Vue
    this.$router.push('/')
  }
}
</script>
