/**
 * lib/fx/useFxRate.ts
 *
 * TanStack Query hook for fetching FX rates.
 * Returns the rate and loading/error state. Falls back to manual entry when offline.
 */

import type { CurrencyCode } from '@domain/currency';
import { isSameCurrency } from '@domain/currency';
import { useQuery } from '@tanstack/react-query';
import { getFxRate } from './fxService';

export function useFxRate(expenseCurrency: CurrencyCode, baseCurrency: CurrencyCode) {
  const same = isSameCurrency(expenseCurrency, baseCurrency);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fxRate', expenseCurrency, baseCurrency],
    queryFn: () => getFxRate(expenseCurrency, baseCurrency),
    enabled: !same,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });

  if (same) {
    return { rate: 1, isLoading: false, isOffline: false };
  }

  return {
    rate: data ?? null,
    isLoading,
    isOffline: isError || (data === null && !isLoading),
  };
}
