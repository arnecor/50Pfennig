/**
 * balance.property.test.ts
 *
 * Property-based tests for domain/balance/ and domain/splitting/ using fast-check.
 *
 * Invariants verified:
 *  1.  Zero-sum (calculateGroupBalances): sum of all balances === 0
 *  2.  Member completeness: all members appear in the result map
 *  3.  calculateParticipantBalances zero-sum
 *  4.  simplifyDebts — total preserved: sum(instructions) === sum(positive balances)
 *  5.  simplifyDebts — no self-payments
 *  6.  simplifyDebts — all amounts positive
 *  7.  simplifyDebts — applying instructions zeroes every balance
 *  8.  computeBilateralBalance — antisymmetry: bilateral(me,friend) === −bilateral(friend,me)
 *  9.  computeBilateralBalance — third-party immunity
 * 10.  extractSimplifiedDebt — antisymmetry
 * 11.  splitExpense equal — sum invariant
 * 12.  splitExpense percentage — sum invariant
 * 13.  splitExpense exact — sum invariant
 * 14.  Cross-cutting: simplifyDebts ∘ calculateGroupBalances → zero balances after settlement
 * 15.  Cross-cutting: bilateral balance sign agrees with simplified debt sign
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ZERO, money } from '../money';
import { splitExpense } from '../splitting/index';
import type {
  BalanceMap,
  Expense,
  ExpenseId,
  GroupId,
  GroupMember,
  Money,
  Settlement,
  SettlementId,
  UserId,
} from '../types';
import {
  calculateGroupBalances,
  calculateParticipantBalances,
  computeBilateralBalance,
  extractSimplifiedDebt,
  simplifyDebts,
} from './index';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const uid = (s: string) => s as UserId;
const GID = 'g1' as GroupId;

/** Ordered pool of 5 stable user IDs. */
const POOL = ['u1', 'u2', 'u3', 'u4', 'u5'].map(uid);

const toMember = (userId: UserId): GroupMember => ({
  userId,
  groupId: GID,
  displayName: userId as string,
  joinedAt: new Date('2024-01-01'),
  isDeleted: false,
});

/** Sum all values in a BalanceMap (plain number for easy assertions). */
const sumBalances = (map: BalanceMap): number =>
  Array.from(map.values()).reduce((a, b) => a + b, 0);

let _id = 0;
const nextId = () => `id-${_id++}`;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** 2–5 distinct UserIds drawn from POOL. */
const usersArb = fc
  .uniqueArray(fc.integer({ min: 0, max: POOL.length - 1 }), {
    minLength: 2,
    maxLength: POOL.length,
  })
  .map((idxs) => idxs.map((i) => POOL[i] as UserId));

/** Positive cents 1–50 000. */
const posMoneyArb = fc.integer({ min: 1, max: 50_000 }).map(money);

/**
 * Builds a well-formed equal-split Expense from a given user pool.
 * Splits always sum to totalAmount (guaranteed by splitExpense/allocate).
 */
const equalExpenseArb = (users: readonly UserId[]): fc.Arbitrary<Expense> =>
  fc
    .record({
      payerIdx: fc.integer({ min: 0, max: users.length - 1 }),
      participantIdxs: fc.uniqueArray(fc.integer({ min: 0, max: users.length - 1 }), {
        minLength: 1,
        maxLength: users.length,
      }),
      total: posMoneyArb,
    })
    .map(({ payerIdx, participantIdxs, total }) => {
      const paidBy = users[payerIdx] as UserId;
      const participants = participantIdxs.map((i) => users[i] as UserId);
      const splitResult = splitExpense(total, participants, { type: 'equal' });
      const expense: Expense = {
        id: nextId() as ExpenseId,
        groupId: GID,
        description: 'generated',
        totalAmount: total,
        paidBy,
        split: { type: 'equal' },
        splits: Object.entries(splitResult).map(([u, amount]) => ({
          userId: u as UserId,
          amount: amount as Money,
        })),
        createdBy: paidBy,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      return expense;
    });

/** A Settlement between two distinct users drawn from `users`. */
const settlementArb = (users: readonly UserId[]): fc.Arbitrary<Settlement> =>
  fc
    .record({
      fromIdx: fc.integer({ min: 0, max: users.length - 1 }),
      toIdx: fc.integer({ min: 0, max: users.length - 1 }),
      amount: posMoneyArb,
    })
    .filter(({ fromIdx, toIdx }) => fromIdx !== toIdx)
    .map(({ fromIdx, toIdx, amount }) => ({
      id: nextId() as SettlementId,
      batchId: null,
      groupId: GID,
      fromUserId: users[fromIdx] as UserId,
      toUserId: users[toIdx] as UserId,
      amount,
      createdAt: new Date('2024-01-01'),
    }));

const scenarioArb = usersArb.chain((users) =>
  fc.record({
    users: fc.constant(users),
    expenses: fc.array(equalExpenseArb(users), { minLength: 0, maxLength: 5 }),
    settlements: fc.array(settlementArb(users), { minLength: 0, maxLength: 3 }),
  }),
);

const scenarioWithExpensesArb = usersArb.chain((users) =>
  fc.record({
    users: fc.constant(users),
    expenses: fc.array(equalExpenseArb(users), { minLength: 1, maxLength: 5 }),
  }),
);

// ---------------------------------------------------------------------------
// 1. Zero-sum: calculateGroupBalances
// ---------------------------------------------------------------------------

describe('calculateGroupBalances — zero-sum invariant', () => {
  it('holds with no expenses or settlements', () => {
    fc.assert(
      fc.property(usersArb, (users) => {
        const members = users.map(toMember);
        expect(sumBalances(calculateGroupBalances([], [], members))).toBe(0);
      }),
    );
  });

  it('holds with only expenses', () => {
    fc.assert(
      fc.property(scenarioWithExpensesArb, ({ users, expenses }) => {
        const members = users.map(toMember);
        expect(sumBalances(calculateGroupBalances(expenses, [], members))).toBe(0);
      }),
    );
  });

  it('holds with expenses and settlements', () => {
    fc.assert(
      fc.property(scenarioArb, ({ users, expenses, settlements }) => {
        const members = users.map(toMember);
        expect(sumBalances(calculateGroupBalances(expenses, settlements, members))).toBe(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Member completeness
// ---------------------------------------------------------------------------

describe('calculateGroupBalances — member completeness', () => {
  it('every member appears in the result regardless of activity', () => {
    fc.assert(
      fc.property(scenarioArb, ({ users, expenses, settlements }) => {
        const members = users.map(toMember);
        const result = calculateGroupBalances(expenses, settlements, members);
        for (const u of users) {
          expect(result.has(u), `Missing entry for ${u}`).toBe(true);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. calculateParticipantBalances — zero-sum
// ---------------------------------------------------------------------------

describe('calculateParticipantBalances — zero-sum invariant', () => {
  it('sum of all balances is always 0', () => {
    fc.assert(
      fc.property(scenarioArb, ({ expenses, settlements }) => {
        const result = calculateParticipantBalances(expenses, settlements);
        expect(sumBalances(result)).toBe(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. simplifyDebts — total preserved
// ---------------------------------------------------------------------------

describe('simplifyDebts — total preserved', () => {
  it('sum of instruction amounts equals sum of positive balances', () => {
    fc.assert(
      fc.property(scenarioWithExpensesArb, ({ users, expenses }) => {
        const members = users.map(toMember);
        const balances = calculateGroupBalances(expenses, [], members);
        const instructions = simplifyDebts(balances);

        const positiveSum = Array.from(balances.values())
          .filter((b) => b > 0)
          .reduce((a, b) => a + b, 0);

        const instructionSum = instructions.reduce((a, i) => a + (i.amount as number), 0);
        expect(instructionSum).toBe(positiveSum);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. simplifyDebts — no self-payments
// ---------------------------------------------------------------------------

describe('simplifyDebts — no self-payments', () => {
  it('fromUserId !== toUserId for every instruction', () => {
    fc.assert(
      fc.property(scenarioWithExpensesArb, ({ users, expenses }) => {
        const members = users.map(toMember);
        const balances = calculateGroupBalances(expenses, [], members);
        const instructions = simplifyDebts(balances);
        for (const inst of instructions) {
          expect(inst.fromUserId).not.toBe(inst.toUserId);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 6. simplifyDebts — all amounts positive
// ---------------------------------------------------------------------------

describe('simplifyDebts — positive amounts', () => {
  it('every instruction amount is > 0', () => {
    fc.assert(
      fc.property(scenarioWithExpensesArb, ({ users, expenses }) => {
        const members = users.map(toMember);
        const balances = calculateGroupBalances(expenses, [], members);
        const instructions = simplifyDebts(balances);
        for (const inst of instructions) {
          expect(inst.amount).toBeGreaterThan(0);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 7. simplifyDebts — applying instructions zeroes every balance
// ---------------------------------------------------------------------------

describe('simplifyDebts — applying instructions zeroes all balances', () => {
  it('balances are all zero after synthetic settlements from simplifyDebts', () => {
    fc.assert(
      fc.property(scenarioWithExpensesArb, ({ users, expenses }) => {
        const members = users.map(toMember);
        const balances = calculateGroupBalances(expenses, [], members);
        const instructions = simplifyDebts(balances);

        const syntheticSettlements: Settlement[] = instructions.map((inst, i) => ({
          id: `synth-${i}` as SettlementId,
          batchId: null,
          groupId: GID,
          fromUserId: inst.fromUserId,
          toUserId: inst.toUserId,
          amount: inst.amount,
          createdAt: new Date('2024-01-01'),
        }));

        const settled = calculateGroupBalances(expenses, syntheticSettlements, members);
        expect(sumBalances(settled)).toBe(0);
        for (const [userId, balance] of settled) {
          expect(balance, `Balance for ${userId} should be 0`).toBe(ZERO);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 8. computeBilateralBalance — antisymmetry
// ---------------------------------------------------------------------------

describe('computeBilateralBalance — antisymmetry', () => {
  it('bilateral(me, friend) === −bilateral(friend, me)', () => {
    fc.assert(
      fc.property(
        usersArb.chain((users) =>
          fc.record({
            users: fc.constant(users),
            expenses: fc.array(equalExpenseArb(users), { minLength: 0, maxLength: 5 }),
            settlements: fc.array(settlementArb(users), { minLength: 0, maxLength: 3 }),
            pairIdxs: fc.uniqueArray(fc.integer({ min: 0, max: users.length - 1 }), {
              minLength: 2,
              maxLength: 2,
            }),
          }),
        ),
        ({ users, expenses, settlements, pairIdxs }) => {
          const meId = users[pairIdxs[0] as number] as UserId;
          const friendId = users[pairIdxs[1] as number] as UserId;

          const fromMe = computeBilateralBalance(expenses, settlements, meId, friendId);
          const fromFriend = computeBilateralBalance(expenses, settlements, friendId, meId);

          // Use sum-to-zero instead of toBe(−x) to avoid the +0 vs −0 Object.is edge-case
          expect((fromMe as number) + (fromFriend as number)).toBe(0);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// 9. computeBilateralBalance — third-party immunity
// ---------------------------------------------------------------------------

describe('computeBilateralBalance — third-party immunity', () => {
  it('expense paid by a third party has no bilateral effect on alice/bob', () => {
    fc.assert(
      fc.property(
        fc.record({
          total: posMoneyArb,
          aliceShareRaw: fc.integer({ min: 0, max: 50_000 }),
        }),
        ({ total, aliceShareRaw }) => {
          const alice = uid('u1');
          const bob = uid('u2');
          const carol = uid('u3');

          const aliceShare = Math.min(aliceShareRaw, total as number);
          const bobShare = money((total as number) - aliceShare);

          // Carol is the payer — neither alice nor bob paid
          const carolsExpense: Expense = {
            id: nextId() as ExpenseId,
            groupId: GID,
            description: 'carol pays',
            totalAmount: total,
            paidBy: carol,
            split: { type: 'equal' },
            splits: [
              { userId: alice, amount: money(aliceShare) },
              { userId: bob, amount: bobShare },
            ],
            createdBy: carol,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          };

          const balance = computeBilateralBalance([carolsExpense], [], alice, bob);
          expect(balance).toBe(ZERO);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// 10. extractSimplifiedDebt — antisymmetry
// ---------------------------------------------------------------------------

describe('extractSimplifiedDebt — antisymmetry', () => {
  it('extract(instructions, me, friend) === −extract(instructions, friend, me)', () => {
    fc.assert(
      fc.property(
        usersArb.chain((users) =>
          fc.record({
            users: fc.constant(users),
            expenses: fc.array(equalExpenseArb(users), { minLength: 0, maxLength: 5 }),
            pairIdxs: fc.uniqueArray(fc.integer({ min: 0, max: users.length - 1 }), {
              minLength: 2,
              maxLength: 2,
            }),
          }),
        ),
        ({ users, expenses, pairIdxs }) => {
          const members = users.map(toMember);
          const balances = calculateGroupBalances(expenses, [], members);
          const instructions = simplifyDebts(balances);

          const meId = users[pairIdxs[0] as number] as UserId;
          const friendId = users[pairIdxs[1] as number] as UserId;

          const fromMe = extractSimplifiedDebt(instructions, meId, friendId);
          const fromFriend = extractSimplifiedDebt(instructions, friendId, meId);

          // Use sum-to-zero to avoid the +0 vs −0 Object.is edge-case
          expect((fromMe as number) + (fromFriend as number)).toBe(0);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// 11. splitExpense — equal sum invariant
// ---------------------------------------------------------------------------

describe('splitExpense equal — sum invariant (property)', () => {
  it('sum of shares always equals totalAmount for any participant count', () => {
    fc.assert(
      fc.property(
        fc.record({
          total: posMoneyArb,
          count: fc.integer({ min: 1, max: 10 }),
        }),
        ({ total, count }) => {
          const participants = Array.from({ length: count }, (_, i) => uid(`p${i}`));
          const result = splitExpense(total, participants, { type: 'equal' });
          const sum = Object.values(result).reduce((a: number, b: number) => a + b, 0);
          expect(sum).toBe(total as number);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// 12. splitExpense — percentage sum invariant
// ---------------------------------------------------------------------------

describe('splitExpense percentage — sum invariant (property)', () => {
  it('sum of shares always equals totalAmount for any valid basis-point distribution', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            total: posMoneyArb,
            parts: fc.array(fc.integer({ min: 1, max: 9_000 }), { minLength: 1, maxLength: 4 }),
          })
          .filter(({ parts }) => parts.reduce((a, b) => a + b, 0) < 10_000),
        ({ total, parts }) => {
          const participants = parts.map((_, i) => uid(`p${i}`));
          const lastParticipant = uid(`p${parts.length}`);
          const allParticipants = [...participants, lastParticipant];

          const basisPoints: Record<string, number> = {};
          for (let i = 0; i < parts.length; i++) {
            basisPoints[participants[i] as string] = parts[i] as number;
          }
          basisPoints[lastParticipant as string] = 10_000 - parts.reduce((a, b) => a + b, 0);

          const result = splitExpense(total, allParticipants, {
            type: 'percentage',
            basisPoints: basisPoints as Record<UserId, number>,
          });
          const sum = Object.values(result).reduce((a: number, b: number) => a + b, 0);
          expect(sum).toBe(total as number);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// 13. splitExpense — exact sum invariant
// ---------------------------------------------------------------------------

describe('splitExpense exact — sum invariant (property)', () => {
  it('sum of shares always equals totalAmount for any valid exact distribution', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            total: posMoneyArb,
            parts: fc.array(fc.integer({ min: 0, max: 25_000 }), { minLength: 1, maxLength: 4 }),
          })
          .filter(({ total, parts }) => parts.reduce((a, b) => a + b, 0) <= (total as number)),
        ({ total, parts }) => {
          const participants = parts.map((_, i) => uid(`p${i}`));
          const lastParticipant = uid(`p${parts.length}`);
          const allParticipants = [...participants, lastParticipant];

          const amounts: Record<string, Money> = {};
          for (let i = 0; i < parts.length; i++) {
            amounts[participants[i] as string] = money(parts[i] as number);
          }
          amounts[lastParticipant as string] = money(
            (total as number) - parts.reduce((a, b) => a + b, 0),
          );

          const result = splitExpense(total, allParticipants, {
            type: 'exact',
            amounts: amounts as Record<UserId, Money>,
          });
          const sum = Object.values(result).reduce((a: number, b: number) => a + b, 0);
          expect(sum).toBe(total as number);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// 14 & 15. Cross-cutting
// ---------------------------------------------------------------------------

describe('cross-cutting: full simplification cycle', () => {
  it('applying simplified debt instructions as settlements zeroes all group balances', () => {
    fc.assert(
      fc.property(scenarioWithExpensesArb, ({ users, expenses }) => {
        const members = users.map(toMember);

        const balances = calculateGroupBalances(expenses, [], members);
        const instructions = simplifyDebts(balances);

        const settlements: Settlement[] = instructions.map((inst, i) => ({
          id: `synth-${i}` as SettlementId,
          batchId: null,
          groupId: GID,
          fromUserId: inst.fromUserId,
          toUserId: inst.toUserId,
          amount: inst.amount,
          createdAt: new Date('2024-01-01'),
        }));

        const settled = calculateGroupBalances(expenses, settlements, members);

        expect(sumBalances(settled)).toBe(0);
        for (const [userId, balance] of settled) {
          expect(balance, `Balance for ${userId} should be 0`).toBe(ZERO);
        }
      }),
    );
  });

  it('in a 2-person group bilateral balance equals simplified debt exactly', () => {
    // With only 2 users there are no third-party payers or multi-hop chains, so
    // computeBilateralBalance and extractSimplifiedDebt(simplifyDebts(...)) must
    // agree in both sign and magnitude for the pair.
    fc.assert(
      fc.property(
        fc
          .uniqueArray(fc.integer({ min: 0, max: POOL.length - 1 }), {
            minLength: 2,
            maxLength: 2,
          })
          .map((idxs) => idxs.map((i) => POOL[i] as UserId))
          .chain((twoUsers) =>
            fc.record({
              users: fc.constant(twoUsers),
              expenses: fc.array(equalExpenseArb(twoUsers), { minLength: 1, maxLength: 5 }),
            }),
          ),
        ({ users, expenses }) => {
          const [meId, friendId] = users as [UserId, UserId];
          const members = users.map(toMember);

          const balances = calculateGroupBalances(expenses, [], members);
          const instructions = simplifyDebts(balances);

          const bilateral = computeBilateralBalance(expenses, [], meId, friendId);
          const simplified = extractSimplifiedDebt(instructions, meId, friendId);

          // In a 2-person group these must be identical (same sign, same magnitude).
          // Use subtraction to avoid Object.is(+0, -0) false-negative.
          expect((bilateral as number) - (simplified as number)).toBe(0);
        },
      ),
    );
  });
});
