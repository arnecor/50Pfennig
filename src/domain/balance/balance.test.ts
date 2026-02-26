import { describe, it, expect } from 'vitest';
import { calculateGroupBalances, simplifyDebts } from './index';
import { money, ZERO } from '../money';
import type {
  UserId, GroupId, ExpenseId, SettlementId,
  Expense, Settlement, GroupMember, BalanceMap,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid  = (s: string) => s as UserId;
const gid  = 'group-1' as GroupId;
const eid  = (s: string) => s as ExpenseId;
const sid  = (s: string) => s as SettlementId;

const alice = uid('alice');
const bob   = uid('bob');
const carol = uid('carol');

const member = (userId: UserId): GroupMember => ({
  userId,
  groupId: gid,
  displayName: userId as string,
  joinedAt: new Date('2024-01-01'),
});

const members = [member(alice), member(bob), member(carol)];

/** Build a minimal Expense — only supply what each test needs. */
const makeExpense = (
  id: string,
  paidBy: UserId,
  totalAmount: number,
  splits: Array<{ userId: UserId; amount: number }>,
): Expense => ({
  id:          eid(id),
  groupId:     gid,
  description: 'test expense',
  totalAmount: money(totalAmount),
  paidBy,
  split:       { type: 'equal' },
  splits:      splits.map((s) => ({ userId: s.userId, amount: money(s.amount) })),
  createdBy:   paidBy,
  createdAt:   new Date('2024-01-01'),
  updatedAt:   new Date('2024-01-01'),
});

/** Build a minimal Settlement. */
const makeSettlement = (
  id: string,
  from: UserId,
  to: UserId,
  amount: number,
): Settlement => ({
  id:          sid(id),
  groupId:     gid,
  fromUserId:  from,
  toUserId:    to,
  amount:      money(amount),
  createdAt:   new Date('2024-01-01'),
});

/** Returns the sum of all values in a BalanceMap. */
const balanceSum = (map: BalanceMap): number =>
  Array.from(map.values()).reduce((a, b) => a + b, 0);

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
      { userId: bob,   amount: 1000 },
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
      { userId: bob,   amount: 5000 },
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
      { userId: bob,   amount: 1000 },
      { userId: carol, amount: 1000 },
    ]);
    const exp2 = makeExpense('e2', bob, 3000, [
      { userId: alice, amount: 1000 },
      { userId: bob,   amount: 1000 },
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
      { userId: bob,   amount: 1000 },
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
      { userId: bob,   amount: 1000 },
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
      { userId: bob,   amount: 1000 },
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
      { userId: bob,   amount: 1233 },
      { userId: carol, amount: 1233 },
    ]);
    const exp2 = makeExpense('e2', carol, 5000, [
      { userId: alice, amount: 1667 },
      { userId: bob,   amount: 1667 },
      { userId: carol, amount: 1666 },
    ]);
    const settlement = makeSettlement('s1', bob, alice, 500);
    const result = calculateGroupBalances([exp1, exp2], [settlement], members);
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
      [bob,   ZERO],
      [carol, ZERO],
    ]);
    expect(simplifyDebts(balances)).toHaveLength(0);
  });

  it('single creditor and single debtor produces one instruction', () => {
    const balances: BalanceMap = new Map([
      [alice, money(1000)],   // owed €10
      [bob,   money(-1000)],  // owes €10
    ]);
    const result = simplifyDebts(balances);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ fromUserId: bob, toUserId: alice, amount: money(1000) });
  });

  it('triangle debt: A owes B, B owes C, C owes A — all net to zero', () => {
    // Each person both owes and is owed €10 → net balance is zero → no instructions
    const balances: BalanceMap = new Map([
      [alice, ZERO],
      [bob,   ZERO],
      [carol, ZERO],
    ]);
    expect(simplifyDebts(balances)).toHaveLength(0);
  });

  it('two debtors, one creditor', () => {
    // Alice is owed €20, Bob owes €10, Carol owes €10
    const balances: BalanceMap = new Map([
      [alice, money(2000)],
      [bob,   money(-1000)],
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
      [bob,   money(1000)],
      [carol, money(-2000)],
    ]);
    const result = simplifyDebts(balances);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.fromUserId === carol)).toBe(true);
  });

  it('instruction amounts sum to the total amount owed', () => {
    const balances: BalanceMap = new Map([
      [alice, money(3000)],
      [bob,   money(-1000)],
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
      [bob,   money(-1000)],
      [carol, money(-2000)],
    ]);
    const result = simplifyDebts(balances);
    // Greedy: largest debtor (carol, 2000) pays largest creditor (alice, 3000)
    // Then bob (1000) pays alice (1000 remaining)
    expect(result).toHaveLength(2);
    const carolPays = result.find((i) => i.fromUserId === carol);
    const bobPays   = result.find((i) => i.fromUserId === bob);
    expect(carolPays?.toUserId).toBe(alice);
    expect(carolPays?.amount).toBe(money(2000));
    expect(bobPays?.toUserId).toBe(alice);
    expect(bobPays?.amount).toBe(money(1000));
  });
});
