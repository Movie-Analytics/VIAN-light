import { createI18n } from 'vue-i18n'

import en from './locales/en.json'
import de from './locales/de.json'

// Detect system / browser language
const systemLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase()

// Only support EN / DE
const locale = systemLang.startsWith('de') ? 'de' : 'en'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale,
  fallbackLocale: 'en',
  messages: {
    en,
    de
  }
})
