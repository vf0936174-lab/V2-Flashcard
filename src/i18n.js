// src/i18n.js
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/common.json'
import ko from './locales/ko/common.json'
import zhHant from './locales/zh-Hant/common.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      ko: { common: ko },
      'zh-Hant': { common: zhHant }
    },
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false }
  })

// 偵錯用：暫時暴露 i18n 到 window（部署確認後可移除）
window.i18n = i18n

export default i18n
