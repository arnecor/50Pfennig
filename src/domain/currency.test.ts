import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_CURRENCIES,
  currencyCode,
  currencyMinorUnits,
  getCurrencyFlag,
  getCurrencySymbol,
  isSameCurrency,
  isZeroDecimalCurrency,
  localeToCurrency,
} from './currency';

// ---------------------------------------------------------------------------
// currencyCode() constructor
// ---------------------------------------------------------------------------

describe('currencyCode()', () => {
  it('accepts valid 3-letter ISO codes', () => {
    expect(currencyCode('EUR')).toBe('EUR');
    expect(currencyCode('USD')).toBe('USD');
    expect(currencyCode('JPY')).toBe('JPY');
  });

  it('throws on codes that are not exactly 3 characters', () => {
    expect(() => currencyCode('EU')).toThrow();
    expect(() => currencyCode('EURO')).toThrow();
    expect(() => currencyCode('')).toThrow();
  });

  it('throws on lowercase codes', () => {
    expect(() => currencyCode('eur')).toThrow();
    expect(() => currencyCode('Eur')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// isSameCurrency
// ---------------------------------------------------------------------------

describe('isSameCurrency', () => {
  it('returns true for identical codes', () => {
    expect(isSameCurrency(currencyCode('EUR'), currencyCode('EUR'))).toBe(true);
  });

  it('returns false for different codes', () => {
    expect(isSameCurrency(currencyCode('EUR'), currencyCode('USD'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// currencyMinorUnits
// ---------------------------------------------------------------------------

describe('currencyMinorUnits', () => {
  it('returns 100 for standard currencies', () => {
    expect(currencyMinorUnits(currencyCode('EUR'))).toBe(100);
    expect(currencyMinorUnits(currencyCode('USD'))).toBe(100);
    expect(currencyMinorUnits(currencyCode('GBP'))).toBe(100);
    expect(currencyMinorUnits(currencyCode('THB'))).toBe(100);
  });

  it('returns 1 for zero-decimal currencies', () => {
    expect(currencyMinorUnits(currencyCode('JPY'))).toBe(1);
    expect(currencyMinorUnits(currencyCode('KRW'))).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// isZeroDecimalCurrency
// ---------------------------------------------------------------------------

describe('isZeroDecimalCurrency', () => {
  it('returns true for JPY and KRW', () => {
    expect(isZeroDecimalCurrency(currencyCode('JPY'))).toBe(true);
    expect(isZeroDecimalCurrency(currencyCode('KRW'))).toBe(true);
  });

  it('returns false for standard currencies', () => {
    expect(isZeroDecimalCurrency(currencyCode('EUR'))).toBe(false);
    expect(isZeroDecimalCurrency(currencyCode('USD'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCurrencySymbol
// ---------------------------------------------------------------------------

describe('getCurrencySymbol', () => {
  it('returns correct symbols for common currencies', () => {
    expect(getCurrencySymbol(currencyCode('EUR'))).toBe('€');
    expect(getCurrencySymbol(currencyCode('USD'))).toBe('$');
    expect(getCurrencySymbol(currencyCode('GBP'))).toBe('£');
    expect(getCurrencySymbol(currencyCode('JPY'))).toBe('¥');
    expect(getCurrencySymbol(currencyCode('CHF'))).toBe('CHF');
  });
});

// ---------------------------------------------------------------------------
// getCurrencyFlag
// ---------------------------------------------------------------------------

describe('getCurrencyFlag', () => {
  it('returns flag emoji for common currencies', () => {
    expect(getCurrencyFlag(currencyCode('EUR'))).toBe('🇪🇺');
    expect(getCurrencyFlag(currencyCode('USD'))).toBe('🇺🇸');
    expect(getCurrencyFlag(currencyCode('GBP'))).toBe('🇬🇧');
    expect(getCurrencyFlag(currencyCode('JPY'))).toBe('🇯🇵');
  });
});

// ---------------------------------------------------------------------------
// localeToCurrency
// ---------------------------------------------------------------------------

describe('localeToCurrency', () => {
  it('maps German locales to EUR', () => {
    expect(localeToCurrency('de-DE')).toBe('EUR');
    expect(localeToCurrency('de-AT')).toBe('EUR');
    expect(localeToCurrency('de')).toBe('EUR');
  });

  it('maps US locale to USD', () => {
    expect(localeToCurrency('en-US')).toBe('USD');
  });

  it('maps UK locale to GBP', () => {
    expect(localeToCurrency('en-GB')).toBe('GBP');
  });

  it('maps Japanese locale to JPY', () => {
    expect(localeToCurrency('ja-JP')).toBe('JPY');
    expect(localeToCurrency('ja')).toBe('JPY');
  });

  it('maps Thai locale to THB', () => {
    expect(localeToCurrency('th-TH')).toBe('THB');
    expect(localeToCurrency('th')).toBe('THB');
  });

  it('defaults to EUR for unknown locales', () => {
    expect(localeToCurrency('xx-XX')).toBe('EUR');
    expect(localeToCurrency('unknown')).toBe('EUR');
  });
});

// ---------------------------------------------------------------------------
// SUPPORTED_CURRENCIES
// ---------------------------------------------------------------------------

describe('SUPPORTED_CURRENCIES', () => {
  it('contains at least the core currencies', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(codes).toContain('EUR');
    expect(codes).toContain('USD');
    expect(codes).toContain('GBP');
    expect(codes).toContain('CHF');
    expect(codes).toContain('JPY');
    expect(codes).toContain('THB');
  });

  it('every entry has code, name, symbol, and flag', () => {
    for (const entry of SUPPORTED_CURRENCIES) {
      expect(entry.code).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.symbol).toBeTruthy();
      expect(entry.flag).toBeTruthy();
    }
  });

  it('all codes are unique', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('all codes are valid 3-letter uppercase', () => {
    for (const entry of SUPPORTED_CURRENCIES) {
      expect(entry.code).toMatch(/^[A-Z]{3}$/);
    }
  });
});
