import { describe, expect, it } from 'vitest';
import {
  abs,
  add,
  allocate,
  convertToBase,
  formatMoney,
  isNegative,
  isPositive,
  isZero,
  negate,
  subtract,
} from './money';
import { ZERO, money } from './types';

// ---------------------------------------------------------------------------
// money() constructor
// ---------------------------------------------------------------------------

describe('money()', () => {
  it('accepts integer values', () => {
    expect(money(0)).toBe(0);
    expect(money(100)).toBe(100);
    expect(money(-50)).toBe(-50);
  });

  it('throws on non-integer values', () => {
    expect(() => money(1.5)).toThrow();
    expect(() => money(0.1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

describe('add', () => {
  it('adds two Money values', () => {
    expect(add(money(100), money(50))).toBe(money(150));
  });

  it('handles zero', () => {
    expect(add(money(100), ZERO)).toBe(money(100));
    expect(add(ZERO, ZERO)).toBe(ZERO);
  });

  it('handles negative values', () => {
    expect(add(money(100), money(-30))).toBe(money(70));
  });
});

describe('subtract', () => {
  it('subtracts two Money values', () => {
    expect(subtract(money(100), money(30))).toBe(money(70));
  });

  it('can produce negative results', () => {
    expect(subtract(money(30), money(100))).toBe(money(-70));
  });
});

describe('negate', () => {
  it('negates a positive value', () => {
    expect(negate(money(100))).toBe(money(-100));
  });

  it('negates a negative value', () => {
    expect(negate(money(-100))).toBe(money(100));
  });

  it('negates zero to zero', () => {
    expect(negate(ZERO)).toBe(ZERO);
  });
});

describe('abs', () => {
  it('returns positive value unchanged', () => {
    expect(abs(money(100))).toBe(money(100));
  });

  it('returns the absolute value of a negative', () => {
    expect(abs(money(-100))).toBe(money(100));
  });

  it('returns zero for zero', () => {
    expect(abs(ZERO)).toBe(ZERO);
  });
});

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

describe('isPositive / isNegative / isZero', () => {
  it('isPositive', () => {
    expect(isPositive(money(1))).toBe(true);
    expect(isPositive(ZERO)).toBe(false);
    expect(isPositive(money(-1))).toBe(false);
  });

  it('isNegative', () => {
    expect(isNegative(money(-1))).toBe(true);
    expect(isNegative(ZERO)).toBe(false);
    expect(isNegative(money(1))).toBe(false);
  });

  it('isZero', () => {
    expect(isZero(ZERO)).toBe(true);
    expect(isZero(money(0))).toBe(true);
    expect(isZero(money(1))).toBe(false);
    expect(isZero(money(-1))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// allocate — the most critical function
// ---------------------------------------------------------------------------

describe('allocate', () => {
  it('distributes evenly when perfectly divisible', () => {
    expect(allocate(money(300), [1, 1, 1])).toEqual([money(100), money(100), money(100)]);
  });

  it('sum always equals total — 1 cent among 3', () => {
    const result = allocate(money(1), [1, 1, 1]);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBe(1);
  });

  it('sum always equals total — 100 among 3', () => {
    const result = allocate(money(100), [1, 1, 1]);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    // Two get 34, one gets 33
    const sorted = [...result].sort((a, b) => a - b);
    expect(sorted).toEqual([33, 33, 34]);
  });

  it('sum always equals total — 10 among 3', () => {
    const result = allocate(money(10), [1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('single part receives the entire total', () => {
    expect(allocate(money(999), [1])).toEqual([money(999)]);
  });

  it('proportional allocation with different ratios', () => {
    // 75% / 25% of 1000
    const result = allocate(money(1000), [3, 1]);
    expect(result).toEqual([money(750), money(250)]);
  });

  it('zero total distributes as all zeros', () => {
    const result = allocate(money(0), [1, 1, 1]);
    expect(result).toEqual([money(0), money(0), money(0)]);
  });

  it('throws on empty ratios', () => {
    expect(() => allocate(money(100), [])).toThrow();
  });

  it('throws when all ratios are zero', () => {
    expect(() => allocate(money(100), [0, 0, 0])).toThrow();
  });

  it('sum invariant holds for many awkward amounts', () => {
    const cases = [1, 7, 10, 11, 99, 100, 101, 1001, 9999, 10000];
    for (const total of cases) {
      const result = allocate(money(total), [1, 1, 1]);
      const sum = result.reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    }
  });
});

// ---------------------------------------------------------------------------
// convertToBase — FX conversion
// ---------------------------------------------------------------------------

describe('convertToBase', () => {
  it('returns the same amount when fxRate is 1', () => {
    expect(convertToBase(money(1000), 1)).toBe(money(1000));
  });

  it('converts correctly: 1500 THB at rate 37.85 → ~40 EUR (3963 cents)', () => {
    // 150000 cents (THB stored as ×100) / 37.85 = 3963.01… → rounds to 3963
    expect(convertToBase(money(150000), 37.85)).toBe(money(3963));
  });

  it('converts correctly: 100 USD at rate 1.08 → ~93 EUR', () => {
    // 10000 / 1.08 = 9259.259… → rounds to 9259
    expect(convertToBase(money(10000), 1.08)).toBe(money(9259));
  });

  it('rounds to nearest integer cent', () => {
    // 1 / 3 = 0.333… → rounds to 0
    expect(convertToBase(money(1), 3)).toBe(money(0));
    // 2 / 3 = 0.666… → rounds to 1
    expect(convertToBase(money(2), 3)).toBe(money(1));
    // 5 / 2 = 2.5 → rounds to 3 (banker's rounding not used — Math.round)
    expect(convertToBase(money(5), 2)).toBe(money(3));
  });

  it('handles rate < 1 (base currency worth less than original)', () => {
    // 1000 / 0.5 = 2000 — original currency is weaker
    expect(convertToBase(money(1000), 0.5)).toBe(money(2000));
  });

  it('handles very large amounts without overflow', () => {
    // 10,000,000 cents at rate 1.5
    expect(convertToBase(money(10_000_000), 1.5)).toBe(money(6_666_667));
  });

  it('throws on zero rate', () => {
    expect(() => convertToBase(money(1000), 0)).toThrow();
  });

  it('throws on negative rate', () => {
    expect(() => convertToBase(money(1000), -1.5)).toThrow();
  });

  it('handles zero amount correctly', () => {
    expect(convertToBase(ZERO, 1.5)).toBe(ZERO);
  });
});

// ---------------------------------------------------------------------------
// formatMoney
// ---------------------------------------------------------------------------

describe('formatMoney', () => {
  it('formats cents as euros in de-DE locale', () => {
    // de-DE formats as "10,00 €" (locale-dependent)
    const result = formatMoney(money(1000));
    expect(result).toContain('10');
    expect(result).toContain('€');
  });

  it('formats zero correctly', () => {
    const result = formatMoney(ZERO);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('formats negative values', () => {
    const result = formatMoney(money(-500));
    expect(result).toContain('5');
    expect(result).toContain('€');
  });

  it('formats in USD when currency is specified', () => {
    const result = formatMoney(money(1000), 'en-US', 'USD');
    expect(result).toContain('10');
    expect(result).toContain('$');
  });

  it('formats JPY without decimal places', () => {
    // JPY 5000 stored as 500000 cents → displayed as 5,000
    const result = formatMoney(money(500000), 'ja-JP', 'JPY');
    expect(result).toContain('5,000');
  });
});
