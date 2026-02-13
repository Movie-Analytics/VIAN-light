import { createI18n } from 'vue-i18n'

import de from './locales/de.json'
import en from './locales/en.json'

// Detect system / browser language
const systemLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase()

// Only support EN / DE
const locale = systemLang.startsWith('de') ? 'en' : 'en'

export const i18n = createI18n({
  fallbackLocale: 'en',
  globalInjection: true,
  legacy: false,
  locale,
  messages: {
    de,
    en
  }
})
