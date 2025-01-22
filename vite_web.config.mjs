import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import VueRouter from 'unplugin-vue-router/vite'

export default defineConfig({
  root: './src/renderer',
  define: {
    isElectron: false
  },
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
})
