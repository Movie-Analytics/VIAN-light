import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import VueRouter from 'unplugin-vue-router/vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    define: {
      IS_ELECTRON: true,
      APP_VERSION: JSON.stringify(process.env.npm_package_version)
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
  }
})
