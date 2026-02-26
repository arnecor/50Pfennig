import { describe, it, expect } from 'vitest';
import { splitExpense } from './index';
import { money } from '../money';
import type { UserId, ExactSplit, PercentageSplit } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = (s: string) => s as UserId;

const alice = uid('alice');
const bob   = uid('bob');
const carol = uid('carol');

/** Asserts that the sum of all split values equals totalAmount exactly. */
const expectSumEquals = (result: Record<string, number>, total: number) => {
  const sum = Object.values(result).reduce((a, b) => a + b, 0);
  expect(sum).toBe(total);
};

// ---------------------------------------------------------------------------
// Equal split
// ---------------------------------------------------------------------------

describe('splitExpense — equal', () => {
  it('divides evenly when amount is perfectly divisible', () => {
    const result = splitExpense(money(300), [alice, bob, carol], { type: 'equal' });
    expect(result[alice]).toBe(100);
    expect(result[bob]).toBe(100);
    expect(result[carol]).toBe(100);
  });

  it('distributes the remainder by largest-remainder method', () => {
    // 100 / 3 = 33.33… — two get 34, one gets 33
    const result = splitExpense(money(100), [alice, bob, carol], { type: 'equal' });
    const values = Object.values(result).sort((a, b) => a - b);
    expect(values).toEqual([33, 33, 34]);
  });

  it('sum always equals totalAmount for non-divisible amounts', () => {
    const result = splitExpense(money(10), [alice, bob, carol], { type: 'equal' });
    expectSumEquals(result, 10);
  });

  it('single participant receives the full amount', () => {
    const result = splitExpense(money(999), [alice], { type: 'equal' });
    expect(result[alice]).toBe(999);
  });

  it('two participants split evenly', () => {
    const result = splitExpense(money(200), [alice, bob], { type: 'equal' });
    expect(result[alice]).toBe(100);
    expect(result[bob]).toBe(100);
  });

  it('two participants with odd total — one gets the extra cent', () => {
    const result = splitExpense(money(101), [alice, bob], { type: 'equal' });
    const values = Object.values(result).sort((a, b) => a - b);
    expect(values).toEqual([50, 51]);
    expectSumEquals(result, 101);
  });

  it('returns an entry for every participant', () => {
    const result = splitExpense(money(300), [alice, bob, carol], { type: 'equal' });
    expect(Object.keys(result)).toHaveLength(3);
    expect(alice in result).toBe(true);
    expect(bob   in result).toBe(true);
    expect(carol in result).toBe(true);
  });

  it('throws on empty participants list', () => {
    expect(() =>
      splitExpense(money(100), [], { type: 'equal' }),
    ).toThrow('zero participants');
  });
});

// ---------------------------------------------------------------------------
// Exact split
// ---------------------------------------------------------------------------

describe('splitExpense — exact', () => {
  it('returns the specified amounts when they sum to total', () => {
    const split: ExactSplit = {
      type: 'exact',
      amounts: { [alice]: money(700), [bob]: money(300) },
    };
    const result = splitExpense(money(1000), [alice, bob], split);
    expect(result[alice]).toBe(700);
    expect(result[bob]).toBe(300);
  });

  it('throws when amounts sum to less than total', () => {
    const split: ExactSplit = {
      type: 'exact',
      amounts: { [alice]: money(600), [bob]: money(300) },
    };
    expect(() =>
      splitExpense(money(1000), [alice, bob], split),
    ).toThrow('900');
  });

  it('throws when amounts sum to more than total', () => {
    const split: ExactSplit = {
      type: 'exact',
      amounts: { [alice]: money(600), [bob]: money(500) },
    };
    expect(() =>
      splitExpense(money(1000), [alice, bob], split),
    ).toThrow('1100');
  });

  it('throws when a participant is missing from amounts', () => {
    const split: ExactSplit = {
      type: 'exact',
      amounts: { [alice]: money(1000) }, // bob missing
    };
    expect(() =>
      splitExpense(money(1000), [alice, bob], split),
    ).toThrow('missing');
  });

  it('single participant exact split', () => {
    const split: ExactSplit = {
      type: 'exact',
      amounts: { [alice]: money(500) },
    };
    const result = splitExpense(money(500), [alice], split);
    expect(result[alice]).toBe(500);
  });

  it('sum equals totalAmount', () => {
    const split: ExactSplit = {
      type: 'exact',
      amounts: {
        [alice]: money(333),
        [bob]:   money(333),
        [carol]: money(334),
      },
    };
    const result = splitExpense(money(1000), [alice, bob, carol], split);
    expectSumEquals(result, 1000);
  });
});

// ---------------------------------------------------------------------------
// Percentage split
// ---------------------------------------------------------------------------

describe('splitExpense — percentage', () => {
  it('allocates proportionally to basis points', () => {
    const split: PercentageSplit = {
      type: 'percentage',
      basisPoints: { [alice]: 5000, [bob]: 5000 },
    };
    const result = splitExpense(money(1000), [alice, bob], split);
    expect(result[alice]).toBe(500);
    expect(result[bob]).toBe(500);
  });

  it('handles unequal percentages', () => {
    const split: PercentageSplit = {
      type: 'percentage',
      basisPoints: { [alice]: 7500, [bob]: 2500 }, // 75% / 25%
    };
    const result = splitExpense(money(1000), [alice, bob], split);
    expect(result[alice]).toBe(750);
    expect(result[bob]).toBe(250);
  });

  it('throws when basis points sum to less than 10000', () => {
    const split: PercentageSplit = {
      type: 'percentage',
      basisPoints: { [alice]: 5000, [bob]: 4999 },
    };
    expect(() =>
      splitExpense(money(1000), [alice, bob], split),
    ).toThrow('9999');
  });

  it('throws when basis points sum to more than 10000', () => {
    const split: PercentageSplit = {
      type: 'percentage',
      basisPoints: { [alice]: 6000, [bob]: 5000 },
    };
    expect(() =>
      splitExpense(money(1000), [alice, bob], split),
    ).toThrow('11000');
  });

  it('handles the thirds problem without rounding drift', () => {
    // 33.33% / 33.33% / 33.34% — a classic floating-point pitfall
    const split: PercentageSplit = {
      type: 'percentage',
      basisPoints: { [alice]: 3333, [bob]: 3333, [carol]: 3334 },
    };
    const result = splitExpense(money(100), [alice, bob, carol], split);
    expectSumEquals(result, 100);
  });

  it('100% to one participant', () => {
    const split: PercentageSplit = {
      type: 'percentage',
      basisPoints: { [alice]: 10000 },
    };
    const result = splitExpense(money(500), [alice], split);
    expect(result[alice]).toBe(500);
  });

  it('sum equals totalAmount for large uneven amounts', () => {
    const split: PercentageSplit = {
      type: 'percentage',
      basisPoints: { [alice]: 3333, [bob]: 3333, [carol]: 3334 },
    };
    const result = splitExpense(money(9999), [alice, bob, carol], split);
    expectSumEquals(result, 9999);
  });
});

// ---------------------------------------------------------------------------
// Sum invariant across all split types and awkward amounts
// ---------------------------------------------------------------------------

describe('splitExpense — sum invariant', () => {
  const cases: Array<[string, number, number]> = [
    ['1 cent among 3',   1,     3],
    ['7 cents among 3',  7,     3],
    ['100 among 7',      100,   7],
    ['1001 among 4',     1001,  4],
    ['9999 among 9',     9999,  9],
    ['10000 among 3',    10000, 3],
    ['1 cent among 10',  1,     10],
  ];

  for (const [label, total, count] of cases) {
    it(`equal split: ${label}`, () => {
      const participants = Array.from({ length: count }, (_, i) => uid(`u${i}`));
      const result = splitExpense(money(total), participants, { type: 'equal' });
      expectSumEquals(result, total);
    });
  }
});
