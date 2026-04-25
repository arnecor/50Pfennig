/**
 * domain/currency.ts
 *
 * Currency types and metadata for multi-currency support.
 *
 * Rules:
 * - All functions are pure — no side effects, no I/O
 * - CurrencyCode is a branded type (ISO 4217, 3 uppercase letters)
 * - This file imports NOTHING outside src/domain/
 */

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type CurrencyCode = Brand<string, 'CurrencyCode'>;

export type FxRate = number;

export type CurrencyInfo = {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  readonly flag: string;
};

export const currencyCode = (code: string): CurrencyCode => {
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error(`Currency code must be exactly 3 uppercase letters, got "${code}"`);
  }
  return code as CurrencyCode;
};

export const isSameCurrency = (a: CurrencyCode, b: CurrencyCode): boolean =>
  (a as string) === (b as string);

const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set(['JPY', 'KRW', 'VND']);

export const currencyMinorUnits = (code: CurrencyCode): number =>
  ZERO_DECIMAL_CURRENCIES.has(code as string) ? 1 : 100;

export const isZeroDecimalCurrency = (code: CurrencyCode): boolean =>
  ZERO_DECIMAL_CURRENCIES.has(code as string);

const SYMBOL_MAP: Readonly<Record<string, string>> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  KRW: '₩',
  INR: '₹',
  TRY: '₺',
  PLN: 'zł',
  BRL: 'R$',
  ZAR: 'R',
  ILS: '₪',
  PHP: '₱',
  THB: '฿',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  HRK: 'kn',
  ISK: 'kr',
};

export const getCurrencySymbol = (code: CurrencyCode): string =>
  SYMBOL_MAP[code as string] ?? (code as string);

const FLAG_MAP: Readonly<Record<string, string>> = {
  EUR: '🇪🇺',
  USD: '🇺🇸',
  GBP: '🇬🇧',
  CHF: '🇨🇭',
  JPY: '🇯🇵',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
  NZD: '🇳🇿',
  SEK: '🇸🇪',
  NOK: '🇳🇴',
  DKK: '🇩🇰',
  PLN: '🇵🇱',
  CZK: '🇨🇿',
  HUF: '🇭🇺',
  RON: '🇷🇴',
  BGN: '🇧🇬',
  HRK: '🇭🇷',
  ISK: '🇮🇸',
  TRY: '🇹🇷',
  CNY: '🇨🇳',
  KRW: '🇰🇷',
  INR: '🇮🇳',
  THB: '🇹🇭',
  MYR: '🇲🇾',
  SGD: '🇸🇬',
  IDR: '🇮🇩',
  PHP: '🇵🇭',
  VND: '🇻🇳',
  BRL: '🇧🇷',
  MXN: '🇲🇽',
  ZAR: '🇿🇦',
  ILS: '🇮🇱',
};

export const getCurrencyFlag = (code: CurrencyCode): string => FLAG_MAP[code as string] ?? '🏳️';

const LOCALE_CURRENCY_MAP: Readonly<Record<string, string>> = {
  de: 'EUR',
  fr: 'EUR',
  it: 'EUR',
  es: 'EUR',
  nl: 'EUR',
  pt: 'EUR',
  fi: 'EUR',
  el: 'EUR',
  'en-US': 'USD',
  'en-GB': 'GBP',
  'en-AU': 'AUD',
  'en-CA': 'CAD',
  'en-NZ': 'NZD',
  ja: 'JPY',
  ko: 'KRW',
  zh: 'CNY',
  th: 'THB',
  tr: 'TRY',
  pl: 'PLN',
  cs: 'CZK',
  hu: 'HUF',
  ro: 'RON',
  bg: 'BGN',
  hr: 'HRK',
  is: 'ISK',
  sv: 'SEK',
  nb: 'NOK',
  nn: 'NOK',
  da: 'DKK',
  ms: 'MYR',
  id: 'IDR',
  vi: 'VND',
  hi: 'INR',
  he: 'ILS',
  'pt-BR': 'BRL',
};

export const localeToCurrency = (locale: string): CurrencyCode => {
  // Try exact match first (e.g. 'en-US'), then language prefix (e.g. 'en')
  const exact = LOCALE_CURRENCY_MAP[locale];
  if (exact) return exact as CurrencyCode;

  const lang = locale.split('-')[0] ?? '';
  const byLang = LOCALE_CURRENCY_MAP[lang];
  if (byLang) return byLang as CurrencyCode;

  return 'EUR' as CurrencyCode;
};

export const SUPPORTED_CURRENCIES: readonly CurrencyInfo[] = [
  { code: 'EUR' as CurrencyCode, name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD' as CurrencyCode, name: 'US-Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP' as CurrencyCode, name: 'Britisches Pfund', symbol: '£', flag: '🇬🇧' },
  { code: 'CHF' as CurrencyCode, name: 'Schweizer Franken', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'JPY' as CurrencyCode, name: 'Japanischer Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CAD' as CurrencyCode, name: 'Kanadischer Dollar', symbol: '$', flag: '🇨🇦' },
  { code: 'AUD' as CurrencyCode, name: 'Australischer Dollar', symbol: '$', flag: '🇦🇺' },
  { code: 'NZD' as CurrencyCode, name: 'Neuseeland-Dollar', symbol: '$', flag: '🇳🇿' },
  { code: 'SEK' as CurrencyCode, name: 'Schwedische Krone', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK' as CurrencyCode, name: 'Norwegische Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK' as CurrencyCode, name: 'Dänische Krone', symbol: 'kr', flag: '🇩🇰' },
  { code: 'PLN' as CurrencyCode, name: 'Polnischer Zloty', symbol: 'zł', flag: '🇵🇱' },
  { code: 'CZK' as CurrencyCode, name: 'Tschechische Krone', symbol: 'Kč', flag: '🇨🇿' },
  { code: 'HUF' as CurrencyCode, name: 'Ungarischer Forint', symbol: 'Ft', flag: '🇭🇺' },
  { code: 'RON' as CurrencyCode, name: 'Rumänischer Leu', symbol: 'lei', flag: '🇷🇴' },
  { code: 'BGN' as CurrencyCode, name: 'Bulgarischer Lew', symbol: 'лв', flag: '🇧🇬' },
  { code: 'HRK' as CurrencyCode, name: 'Kroatische Kuna', symbol: 'kn', flag: '🇭🇷' },
  { code: 'ISK' as CurrencyCode, name: 'Isländische Krone', symbol: 'kr', flag: '🇮🇸' },
  { code: 'TRY' as CurrencyCode, name: 'Türkische Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'CNY' as CurrencyCode, name: 'Chinesischer Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'KRW' as CurrencyCode, name: 'Südkoreanischer Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'INR' as CurrencyCode, name: 'Indische Rupie', symbol: '₹', flag: '🇮🇳' },
  { code: 'THB' as CurrencyCode, name: 'Thailändischer Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'MYR' as CurrencyCode, name: 'Malaysischer Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'SGD' as CurrencyCode, name: 'Singapur-Dollar', symbol: '$', flag: '🇸🇬' },
  { code: 'IDR' as CurrencyCode, name: 'Indonesische Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'PHP' as CurrencyCode, name: 'Philippinischer Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'VND' as CurrencyCode, name: 'Vietnamesischer Dong', symbol: '₫', flag: '🇻🇳' },
  { code: 'BRL' as CurrencyCode, name: 'Brasilianischer Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN' as CurrencyCode, name: 'Mexikanischer Peso', symbol: '$', flag: '🇲🇽' },
  { code: 'ZAR' as CurrencyCode, name: 'Südafrikanischer Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'ILS' as CurrencyCode, name: 'Israelischer Schekel', symbol: '₪', flag: '🇮🇱' },
];
