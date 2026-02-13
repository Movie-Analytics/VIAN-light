import { createI18n } from 'vue-i18n'

import de from './locales/de.json'
import en from './locales/en.json'

// Detect system / browser language (or keep your savedLocale logic)
const systemLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase()
const locale = systemLang.startsWith('de') ? 'de' : 'en'

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
