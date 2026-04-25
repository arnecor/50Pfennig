import { describe, expect, it } from 'vitest';
import type { CurrencyCode } from '../currency';
import { ZERO, money } from '../money';
import type {
  BalanceMap,
  DebtInstruction,
  Expense,
  ExpenseId,
  GroupId,
  GroupMember,
  Settlement,
  SettlementId,
  UserId,
} from '../types';
import { calculateGroupBalances, extractSimplifiedDebt, simplifyDebts } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = (s: string) => s as UserId;
const gid = 'group-1' as GroupId;
const eid = (s: string) => s as ExpenseId;
const sid = (s: string) => s as SettlementId;
const EUR = 'EUR' as CurrencyCode;

const alice = uid('alice');
const bob = uid('bob');
const carol = uid('carol');

const member = (userId: UserId): GroupMember => ({
  userId,
  groupId: gid,
  displayName: userId as string,
  joinedAt: new Date('2024-01-01'),
  isDeleted: false,
});

const members = [member(alice), member(bob), member(carol)];

/**
 * Build a minimal Expense.
 * By default: same currency (EUR), fxRate 1, baseTotalAmount = totalAmount.
 * Override with opts for multi-currency tests.
 */
const makeExpense = (
  id: string,
  paidBy: UserId,
  totalAmount: number,
  splits: Array<{ userId: UserId; amount: number }>,
  opts?: { currency?: CurrencyCode; fxRate?: number; baseTotalAmount?: number },
): Expense => ({
  id: eid(id),
  groupId: gid,
  description: 'test expense',
  totalAmount: money(totalAmount),
  paidBy,
  split: { type: 'equal' },
  splits: splits.map((s) => ({ userId: s.userId, amount: money(s.amount) })),
  createdBy: paidBy,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  currency: opts?.currency ?? EUR,
  fxRate: opts?.fxRate ?? 1.0,
  baseTotalAmount: money(opts?.baseTotalAmount ?? totalAmount),
});

/**
 * Build a minimal Settlement.
 * By default: EUR, fxRate 1, baseAmount = amount.
 */
const makeSettlement = (
  id: string,
  from: UserId,
  to: UserId,
  amount: number,
  opts?: { currency?: CurrencyCode; fxRate?: number; baseAmount?: number },
): Settlement => ({
  id: sid(id),
  batchId: null,
  groupId: gid,
  fromUserId: from,
  toUserId: to,
  amount: money(amount),
  createdAt: new Date('2024-01-01'),
  currency: opts?.currency ?? EUR,
  fxRate: opts?.fxRate ?? 1.0,
  baseAmount: money(opts?.baseAmount ?? amount),
});

/** Returns the sum of all values in a BalanceMap. */
const balanceSum = (map: BalanceMap): number => Array.from(map.values()).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// calculateGroupBalances
// ---------------------------------------------------------------------------

describe('calculateGroupBalances', () => {
  it('all members start at zero when there are no expenses or settlements', () => {
    const result = calculateGroupBalances([], [], members);
    expect(result.get(alice)).toBe(ZERO);
    expect(result.get(bob)).toBe(ZERO);
    expect(result.get(carol)).toBe(ZERO);
  });

  it('payer is credited, participants are debited', () => {
    // Alice pays €30, split equally: each owes €10
    // Alice: +30 (credit) -10 (debit own share) = +20
    // Bob:   -10
    // Carol: -10
    const expense = makeExpense('e1', alice, 3000, [
      { userId: alice, amount: 1000 },
      { userId: bob, amount: 1000 },
      { userId: carol, amount: 1000 },
    ]);
    const result = calculateGroupBalances([expense], [], members);
    expect(result.get(alice)).toBe(money(2000));
    expect(result.get(bob)).toBe(money(-1000));
    expect(result.get(carol)).toBe(money(-1000));
  });

  it('payer who is not a participant gets the full credit', () => {
    // Alice pays €100 but only Bob and Carol share it
    // Alice: +100
    // Bob:   -50
    // Carol: -50
    const expense = makeExpense('e1', alice, 10000, [
      { userId: bob, amount: 5000 },
      { userId: carol, amount: 5000 },
    ]);
    const result = calculateGroupBalances([expense], [], members);
    expect(result.get(alice)).toBe(money(10000));
    expect(result.get(bob)).toBe(money(-5000));
    expect(result.get(carol)).toBe(money(-5000));
  });

  it('multiple expenses accumulate correctly', () => {
    const exp1 = makeExpense('e1', alice, 3000, [
      { userId: alice, amount: 1000 },
      { userId: bob, amount: 1000 },
      { userId: carol, amount: 1000 },
    ]);
    const exp2 = makeExpense('e2', bob, 3000, [
      { userId: alice, amount: 1000 },
      { userId: bob, amount: 1000 },
      { userId: carol, amount: 1000 },
    ]);
    // After two equal expenses (Alice pays one, Bob pays one):
    // Alice: +3000 -1000 (exp1) -1000 (exp2) = +1000
    // Bob:   -1000 (exp1) +3000 -1000 (exp2) = +1000
    // Carol: -1000 (exp1) -1000 (exp2) = -2000
    const result = calculateGroupBalances([exp1, exp2], [], members);
    expect(result.get(alice)).toBe(money(1000));
    expect(result.get(bob)).toBe(money(1000));
    expect(result.get(carol)).toBe(money(-2000));
  });

  it('settlement reduces the outstanding debt', () => {
    const expense = makeExpense('e1', alice, 3000, [
      { userId: alice, amount: 1000 },
      { userId: bob, amount: 1000 },
      { userId: carol, amount: 1000 },
    ]);
    // Bob pays Alice back €10
    const settlement = makeSettlement('s1', bob, alice, 1000);
    const result = calculateGroupBalances([expense], [settlement], members);
    // Alice: +2000 (after expense) -1000 (settlement received) = +1000
    // Bob:   -1000 (after expense) +1000 (settlement sent) = 0
    // Carol: -1000
    expect(result.get(alice)).toBe(money(1000));
    expect(result.get(bob)).toBe(ZERO);
    expect(result.get(carol)).toBe(money(-1000));
  });

  it('full settlement zeroes out all balances', () => {
    const expense = makeExpense('e1', alice, 2000, [
      { userId: alice, amount: 1000 },
      { userId: bob, amount: 1000 },
    ]);
    const settlement = makeSettlement('s1', bob, alice, 1000);
    const twoMembers = [member(alice), member(bob)];
    const result = calculateGroupBalances([expense], [settlement], twoMembers);
    expect(result.get(alice)).toBe(ZERO);
    expect(result.get(bob)).toBe(ZERO);
  });

  it('members with no activity have zero balance', () => {
    // Carol has no expenses or settlements
    const expense = makeExpense('e1', alice, 2000, [
      { userId: alice, amount: 1000 },
      { userId: bob, amount: 1000 },
    ]);
    const result = calculateGroupBalances([expense], [], members);
    expect(result.get(carol)).toBe(ZERO);
  });

  it('returns an entry for every member', () => {
    const result = calculateGroupBalances([], [], members);
    expect(result.has(alice)).toBe(true);
    expect(result.has(bob)).toBe(true);
    expect(result.has(carol)).toBe(true);
    expect(result.size).toBe(3);
  });

  it('zero-sum invariant: all balances always sum to zero', () => {
    const exp1 = makeExpense('e1', alice, 3700, [
      { userId: alice, amount: 1234 },
      { userId: bob, amount: 1233 },
      { userId: carol, amount: 1233 },
    ]);
    const exp2 = makeExpense('e2', carol, 5000, [
      { userId: alice, amount: 1667 },
      { userId: bob, amount: 1667 },
      { userId: carol, amount: 1666 },
    ]);
    const settlement = makeSettlement('s1', bob, alice, 500);
    const result = calculateGroupBalances([exp1, exp2], [settlement], members);
    expect(balanceSum(result)).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Multi-currency: balances use baseTotalAmount, not totalAmount
  // ---------------------------------------------------------------------------

  it('uses baseTotalAmount for payer credit, not totalAmount', () => {
    // Alice pays 1500 THB (totalAmount=150000), which converts to ~40 EUR (baseTotalAmount=3963)
    // Splits are in base currency: each owes ~€13.21
    const THB = 'THB' as CurrencyCode;
    const expense = makeExpense(
      'e1',
      alice,
      150000, // 1500 THB in cents
      [
        { userId: alice, amount: 1321 },
        { userId: bob, amount: 1321 },
        { userId: carol, amount: 1321 },
      ],
      { currency: THB, fxRate: 37.85, baseTotalAmount: 3963 },
    );
    const result = calculateGroupBalances([expense], [], members);
    // Alice: +3963 (baseTotalAmount credit) -1321 (own share) = +2642
    expect(result.get(alice)).toBe(money(2642));
    expect(result.get(bob)).toBe(money(-1321));
    expect(result.get(carol)).toBe(money(-1321));
  });

  it('zero-sum holds for multi-currency expenses', () => {
    const THB = 'THB' as CurrencyCode;
    const expense = makeExpense(
      'e1',
      alice,
      150000,
      [
        { userId: alice, amount: 1321 },
        { userId: bob, amount: 1321 },
        { userId: carol, amount: 1321 },
      ],
      { currency: THB, fxRate: 37.85, baseTotalAmount: 3963 },
    );
    const result = calculateGroupBalances([expense], [], members);
    expect(balanceSum(result)).toBe(0);
  });

  it('uses settlement baseAmount, not amount', () => {
    // Expense in THB, settlement in base currency (EUR)
    const THB = 'THB' as CurrencyCode;
    const expense = makeExpense(
      'e1',
      alice,
      60000, // 600 THB
      [
        { userId: alice, amount: 500 },
        { userId: bob, amount: 500 },
      ],
      { currency: THB, fxRate: 30.0, baseTotalAmount: 1000 },
    );
    // Bob settles his €5 debt
    const settlement = makeSettlement('s1', bob, alice, 500, { baseAmount: 500 });
    const twoMembers = [member(alice), member(bob)];
    const result = calculateGroupBalances([expense], [settlement], twoMembers);
    expect(result.get(alice)).toBe(ZERO);
    expect(result.get(bob)).toBe(ZERO);
  });

  it('mixes same-currency and multi-currency expenses correctly', () => {
    // Expense 1: EUR (same currency)
    const eurExpense = makeExpense('e1', alice, 3000, [
      { userId: alice, amount: 1000 },
      { userId: bob, amount: 1000 },
      { userId: carol, amount: 1000 },
    ]);
    // Expense 2: USD at rate 1.08 → €9259 base for $10000
    const USD = 'USD' as CurrencyCode;
    const usdExpense = makeExpense(
      'e2',
      bob,
      10000,
      [
        { userId: alice, amount: 3086 },
        { userId: bob, amount: 3087 },
        { userId: carol, amount: 3086 },
      ],
      { currency: USD, fxRate: 1.08, baseTotalAmount: 9259 },
    );
    const result = calculateGroupBalances([eurExpense, usdExpense], [], members);
    // Alice: +3000 -1000 (eur) -3086 (usd share) = -1086
    // Bob:   -1000 (eur) +9259 -3087 (usd) = +5172
    // Carol: -1000 (eur) -3086 (usd share) = -4086
    expect(result.get(alice)).toBe(money(-1086));
    expect(result.get(bob)).toBe(money(5172));
    expect(result.get(carol)).toBe(money(-4086));
    expect(balanceSum(result)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// simplifyDebts
// ---------------------------------------------------------------------------

describe('simplifyDebts', () => {
  it('returns no instructions when all balances are zero', () => {
    const balances: BalanceMap = new Map([
      [alice, ZERO],
      [bob, ZERO],
      [carol, ZERO],
    ]);
    expect(simplifyDebts(balances)).toHaveLength(0);
  });

  it('single creditor and single debtor produces one instruction', () => {
    const balances: BalanceMap = new Map([
      [alice, money(1000)], // owed €10
      [bob, money(-1000)], // owes €10
    ]);
    const result = simplifyDebts(balances);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ fromUserId: bob, toUserId: alice, amount: money(1000) });
  });

  it('triangle debt: A owes B, B owes C, C owes A — all net to zero', () => {
    // Each person both owes and is owed €10 → net balance is zero → no instructions
    const balances: BalanceMap = new Map([
      [alice, ZERO],
      [bob, ZERO],
      [carol, ZERO],
    ]);
    expect(simplifyDebts(balances)).toHaveLength(0);
  });

  it('two debtors, one creditor', () => {
    // Alice is owed €20, Bob owes €10, Carol owes €10
    const balances: BalanceMap = new Map([
      [alice, money(2000)],
      [bob, money(-1000)],
      [carol, money(-1000)],
    ]);
    const result = simplifyDebts(balances);
    expect(result).toHaveLength(2);
    const total = result.reduce((sum, i) => sum + i.amount, 0);
    expect(total).toBe(2000);
    // Both instructions pay Alice
    expect(result.every((i) => i.toUserId === alice)).toBe(true);
  });

  it('one debtor, two creditors', () => {
    // Carol owes €20 total: €10 to Alice, €10 to Bob
    const balances: BalanceMap = new Map([
      [alice, money(1000)],
      [bob, money(1000)],
      [carol, money(-2000)],
    ]);
    const result = simplifyDebts(balances);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.fromUserId === carol)).toBe(true);
  });

  it('instruction amounts sum to the total amount owed', () => {
    const balances: BalanceMap = new Map([
      [alice, money(3000)],
      [bob, money(-1000)],
      [carol, money(-2000)],
    ]);
    const result = simplifyDebts(balances);
    const instructionTotal = result.reduce((sum, i) => sum + i.amount, 0);
    // Total owed = 1000 + 2000 = 3000 (sum of debtor balances)
    expect(instructionTotal).toBe(3000);
  });

  it('unequal debtor amounts are handled correctly', () => {
    // Alice owed €30, Bob owes €10, Carol owes €20
    const balances: BalanceMap = new Map([
      [alice, money(3000)],
      [bob, money(-1000)],
      [carol, money(-2000)],
    ]);
    const result = simplifyDebts(balances);
    // Greedy: largest debtor (carol, 2000) pays largest creditor (alice, 3000)
    // Then bob (1000) pays alice (1000 remaining)
    expect(result).toHaveLength(2);
    const carolPays = result.find((i) => i.fromUserId === carol);
    const bobPays = result.find((i) => i.fromUserId === bob);
    expect(carolPays?.toUserId).toBe(alice);
    expect(carolPays?.amount).toBe(money(2000));
    expect(bobPays?.toUserId).toBe(alice);
    expect(bobPays?.amount).toBe(money(1000));
  });
});

// ---------------------------------------------------------------------------
// extractSimplifiedDebt
// ---------------------------------------------------------------------------

describe('extractSimplifiedDebt', () => {
  const inst = (from: UserId, to: UserId, amount: number): DebtInstruction => ({
    fromUserId: from,
    toUserId: to,
    amount: money(amount),
  });

  it('returns ZERO when no instructions exist', () => {
    expect(extractSimplifiedDebt([], alice, bob)).toBe(ZERO);
  });

  it('returns ZERO when no instructions involve both users', () => {
    const instructions = [inst(carol, alice, 1000), inst(carol, bob, 500)];
    expect(extractSimplifiedDebt(instructions, alice, bob)).toBe(ZERO);
  });

  it('returns positive when friend owes me (friend → me)', () => {
    const instructions = [inst(bob, alice, 1500)];
    expect(extractSimplifiedDebt(instructions, alice, bob)).toBe(money(1500));
  });

  it('returns negative when I owe friend (me → friend)', () => {
    const instructions = [inst(alice, bob, 800)];
    expect(extractSimplifiedDebt(instructions, alice, bob)).toBe(money(-800));
  });

  it('sums multiple instructions between the pair', () => {
    // Unusual but possible after rounding: two instructions in same direction
    const instructions = [inst(bob, alice, 1000), inst(bob, alice, 500)];
    expect(extractSimplifiedDebt(instructions, alice, bob)).toBe(money(1500));
  });

  it('ignores instructions not involving both users', () => {
    const instructions = [
      inst(carol, alice, 2000), // carol → alice, not bob
      inst(bob, alice, 1000), // bob → alice (relevant)
    ];
    expect(extractSimplifiedDebt(instructions, alice, bob)).toBe(money(1000));
  });

  it('is symmetric: result for (alice, bob) is negation of (bob, alice)', () => {
    const instructions = [inst(bob, alice, 1200)];
    const fromAlice = extractSimplifiedDebt(instructions, alice, bob);
    const fromBob = extractSimplifiedDebt(instructions, bob, alice);
    expect(fromAlice).toBe(money(1200));
    expect(fromBob).toBe(money(-1200));
  });
});
