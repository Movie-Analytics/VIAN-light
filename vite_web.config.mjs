import { resolve } from 'path'
import { defineConfig, mergeConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import VueRouter from 'unplugin-vue-router/vite'

const baseConfig = {
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
}

const developmentConfig = {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  if (mode === 'development') {
    return mergeConfig(baseConfig, developmentConfig)
  } else {
    return baseConfig
  }
})
