import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import VueRouter from 'unplugin-vue-router/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      VueRouter({ root: process.cwd() + '/src/renderer' }),
      vue({ template: { transformAssetUrls } }),
      Vuetify()
    ]
  }
})
