/**
 * domain/money.ts
 *
 * Pure arithmetic functions for the Money type (integer cents).
 *
 * Rules:
 * - All functions are pure — no side effects, no I/O
 * - All monetary values are integer cents (Money branded type)
 * - The allocate() function is the ONLY correct way to split a total across
 *   participants. It uses the largest-remainder method to guarantee that
 *   results always sum exactly to the original amount. Never write manual
 *   rounding logic elsewhere.
 *
 * See ADR-0003 for rationale on integer cents + basis points.
 */

import { Money, money, ZERO } from './types';

export { money, ZERO } from './types';

export const add      = (a: Money, b: Money): Money => money(a + b);
export const subtract = (a: Money, b: Money): Money => money(a - b);
export const negate   = (a: Money): Money => a === 0 ? ZERO : money(-a);
export const abs      = (a: Money): Money => money(Math.abs(a));

export const isPositive = (a: Money): boolean => a > 0;
export const isNegative = (a: Money): boolean => a < 0;
export const isZero     = (a: Money): boolean => a === ZERO;

/**
 * Allocates `total` across N parts proportional to `ratios`.
 *
 * Uses the largest-remainder (Hamilton) method so the returned values
 * always sum EXACTLY to `total` — no rounding drift, no off-by-one cents.
 *
 * @param total  - The amount to distribute (integer cents)
 * @param ratios - Relative weights for each part (e.g. [1,1,1] for equal,
 *                 or basis points [3333,3333,3334] for percentage splits)
 * @returns      Array of Money values in the same order as ratios
 *
 * @example
 * allocate(money(100), [1, 1, 1]) → [money(34), money(33), money(33)]
 * // sum = 100 ✓
 */
export const allocate = (total: Money, ratios: readonly number[]): Money[] => {
  if (ratios.length === 0) throw new Error('Cannot allocate to zero parts');

  const sumOfRatios = ratios.reduce((a, b) => a + b, 0);
  if (sumOfRatios === 0) throw new Error('Ratios must not all be zero');

  // Step 1: compute exact (fractional) share for each part
  const exactShares = ratios.map(r => (r / sumOfRatios) * total);

  // Step 2: floor each share to get the base integer allocation
  const floored = exactShares.map(s => Math.floor(s));

  // Step 3: the remainder (in cents) that hasn't been distributed yet
  const remainder = total - floored.reduce((a, b) => a + b, 0);

  // Step 4: distribute remainder one cent at a time to the parts with
  // the largest fractional part (largest-remainder / Hamilton method)
  const indexed = exactShares.map((s, i) => ({ i, frac: s - Math.floor(s) }));
  indexed.sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) {
    floored[indexed[k]!.i]! += 1;
  }

  return floored.map(money);
};

/**
 * Formats a Money value for display.
 * Always use this — never format cents manually in components.
 *
 * @param m        - The value to format
 * @param locale   - BCP 47 locale tag (default: 'de-DE')
 * @param currency - ISO 4217 currency code (default: 'EUR')
 */
export const formatMoney = (
  m: Money,
  locale  = 'de-DE',
  currency = 'EUR',
): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(m / 100);
