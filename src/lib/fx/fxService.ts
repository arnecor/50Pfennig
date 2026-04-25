/**
 * lib/fx/fxService.ts
 *
 * FX rate fetching service using the frankfurter.dev v2 API.
 *
 * Returns null when offline or the pair is unsupported — the UI falls back to manual entry.
 * Rates are cached in memory for 24 hours per currency pair, so that offline use cases are supported.
 */

import type { CurrencyCode } from '@domain/currency';

const CACHE_TTL_MS = 60 * 60 * 1000 * 24; // 24 hours caching 
type PairCacheEntry = { rate: number; fetchedAt: number };
const cache = new Map<string, PairCacheEntry>();

/**
 * Gets the FX rate for a specific currency pair.
 * Returns units of `fromCurrency` per 1 unit of `toCurrency` (base).
 * Returns null when offline or the pair is unsupported.
 *
 * Example: getFxRate('USD', 'EUR') → 1.17  (1 EUR = 1.17 USD)
 */
export const getFxRate = async (
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
): Promise<number | null> => {
  if ((fromCurrency as string) === (toCurrency as string)) return 1;

  const key = `${toCurrency as string}/${fromCurrency as string}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/${toCurrency as string}/${fromCurrency as string}`,
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { rate: number };
    cache.set(key, { rate: data.rate, fetchedAt: Date.now() });
    return data.rate;
  } catch {
    return null;
  }
};
