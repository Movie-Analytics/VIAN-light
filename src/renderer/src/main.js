import './assets/main.css'
import '@mdi/font/css/materialdesignicons.css'

import 'vuetify/styles'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'

import router from './router'
import App from './App.vue'

const vuetify = createVuetify()
const pinia = createPinia()

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(vuetify)
app.mount('#app')
