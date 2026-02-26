/**
 * lib/i18n.ts
 *
 * Initializes i18next with the HTTP backend.
 * Import this file once (in main.tsx) as a side effect — it needs no export.
 *
 * Translations live in public/locales/{lng}/translation.json.
 * German (de) is the default; English (en) is the fallback.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng:          'de',
    fallbackLng:  'en',
    ns:           ['translation'],
    defaultNS:    'translation',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
