import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(Backend) // loads translations from /locales
  .use(LanguageDetector) // detects user language
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en','ko','zh-Hant'], // English, Korean, Traditional Chinese
    ns: ['common'], // namespaces you use
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json'
    },
    detection: {
      order: ['querystring','localStorage','navigator'],
      caches: ['localStorage']
    },
    interpolation: { escapeValue: false }
  });

export default i18n;
