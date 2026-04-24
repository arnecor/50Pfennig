/**
 * lib/fx/fxService.ts
 *
 * FX rate fetching service using the frankfurter.app API.
 *
 * Returns null when offline or API fails — the UI falls back to manual entry.
 * Rates are cached in memory for 1 hour per base currency.
 */

import type { CurrencyCode } from '@domain/currency';

type RateMap = Record<string, number>;

type CacheEntry = {
  rates: RateMap;
  fetchedAt: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

/**
 * Fetches latest FX rates from frankfurter.app for a given base currency.
 * Returns a map of currency code → rate, or null on failure.
 *
 * frankfurter.app only supports EUR as base. For non-EUR base currencies,
 * we fetch EUR-based rates and compute cross-rates.
 */
export const fetchFxRates = async (baseCurrency: CurrencyCode): Promise<RateMap | null> => {
  const cacheKey = baseCurrency as string;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=EUR');
    if (!response.ok) return null;

    const data = (await response.json()) as { rates: RateMap };
    const eurRates = data.rates;

    let rates: RateMap;

    if ((baseCurrency as string) === 'EUR') {
      rates = eurRates;
    } else {
      // Compute cross-rates: rate(X/base) = rate(X/EUR) / rate(base/EUR)
      const baseToEur = eurRates[baseCurrency as string];
      if (!baseToEur) return null;

      rates = {};
      for (const [code, eurRate] of Object.entries(eurRates)) {
        if (code === (baseCurrency as string)) continue;
        rates[code] = eurRate / baseToEur;
      }
      rates.EUR = 1 / baseToEur;
    }

    cache.set(cacheKey, { rates, fetchedAt: Date.now() });
    return rates;
  } catch {
    return null;
  }
};

/**
 * Gets the FX rate for a specific currency pair.
 * Returns units of `fromCurrency` per 1 unit of `toCurrency` (base).
 *
 * Example: getFxRate('THB', 'EUR') → 37.85 (1 EUR = 37.85 THB)
 */
export const getFxRate = async (
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
): Promise<number | null> => {
  if ((fromCurrency as string) === (toCurrency as string)) return 1;

  const rates = await fetchFxRates(toCurrency);
  if (!rates) return null;

  return rates[fromCurrency as string] ?? null;
};
