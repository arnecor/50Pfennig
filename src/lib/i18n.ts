/**
 * lib/i18n.ts
 *
 * Call initI18n() once before rendering the app (in main.tsx).
 * On native (Android/iOS) it uses Capacitor's Device API to get the real system locale.
 * On web it falls back to navigator.language.
 * Manual overrides from AccountPage (i18n.changeLanguage) are persisted in localStorage
 * by LanguageDetector and take priority on subsequent launches.
 *
 * Translations live in public/locales/{lng}/translation.json.
 */

import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

const SUPPORTED = ['de', 'en'] as const;
const STORAGE_KEY = 'i18nextLng';

function normalise(code: string): string {
  const base = (code.split('-')[0] ?? '').toLowerCase();
  return SUPPORTED.includes(base as (typeof SUPPORTED)[number]) ? base : 'en';
}

async function resolveLanguage(): Promise<string> {
  // User's manual override (written by LanguageDetector on i18n.changeLanguage())
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED.includes(stored as (typeof SUPPORTED)[number])) {
    return stored;
  }

  // Native platform: Capacitor Device API returns the real Android/iOS system locale
  if (Capacitor.isNativePlatform()) {
    try {
      const { value } = await Device.getLanguageCode();
      return normalise(value);
    } catch {
      return 'en';
    }
  }

  // Web: browser language
  return normalise(navigator.language);
}

export async function initI18n(): Promise<void> {
  const lng = await resolveLanguage();

  // Seed localStorage so LanguageDetector has a value to cache future changes against
  localStorage.setItem(STORAGE_KEY, lng);

  await i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      lng,
      supportedLngs: SUPPORTED,
      fallbackLng: 'en',
      ns: ['translation'],
      defaultNS: 'translation',
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;
