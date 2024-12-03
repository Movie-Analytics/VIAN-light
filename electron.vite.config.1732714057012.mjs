// electron.vite.config.mjs
import { resolve } from "path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import VueRouter from "unplugin-vue-router/vite";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src")
      }
    },
    plugins: [
      VueRouter({ root: process.cwd() + "/src/renderer" }),
      vue({ template: { transformAssetUrls } }),
      Vuetify()
    ]
  }
});
export {
  electron_vite_config_default as default
};
