import './assets/main.css'
import '@mdi/font/css/materialdesignicons.css'

import 'vuetify/styles'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { i18n } from './i18n'
import { setupCsp } from './setupcsp'

import App from './App.vue'
import router from './router'

setupCsp()
const vuetify = createVuetify({ theme: { themes: { dark: false } } })
const pinia = createPinia()

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(vuetify)
app.use(i18n)
app.mount('#app')
