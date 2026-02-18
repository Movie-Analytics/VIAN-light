import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { defineConfig, mergeConfig } from 'vite'
import VueRouter from 'unplugin-vue-router/vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

const baseConfig = {
  define: {
    IS_ELECTRON: false
  },
  plugins: [
    VueRouter({ root: process.cwd() + '/src/renderer' }),
    vue({ template: { transformAssetUrls } }),
    Vuetify()
  ],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  root: './src/renderer'
}

const developmentConfig = {
  server: {
    proxy: {
      '/api': {
        changeOrigin: true,
        target: 'http://localhost:8000'
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  if (mode === 'development') {
    return mergeConfig(baseConfig, developmentConfig)
  }
  return baseConfig
})
