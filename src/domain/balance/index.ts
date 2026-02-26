/**
 * domain/balance/index.ts
 *
 * Balance derivation and debt simplification.
 *
 * Exports two pure functions:
 *
 *   calculateGroupBalances()
 *     Computes the net balance for every member of a group from the full
 *     expense and settlement history. Never reads from the database — always
 *     called with already-fetched data from the TanStack Query cache.
 *
 *     Algorithm:
 *       For each expense:
 *         payer receives CREDIT equal to totalAmount
 *         each participant receives DEBIT equal to their split amount
 *       For each settlement:
 *         sender receives CREDIT equal to amount
 *         receiver receives DEBIT equal to amount
 *
 *   simplifyDebts()
 *     Reduces a BalanceMap to the minimum set of payment instructions
 *     needed to settle all debts. Uses a greedy matching of the largest
 *     creditor against the largest debtor.
 *
 * Rules:
 * - Both functions are pure — no side effects
 * - Balances are NEVER stored in the DB (see ADR-0009)
 * - These are the most correctness-critical functions in the codebase
 *
 * Tested in: balance.test.ts
 */

import { type Money, type UserId, type Expense, type Settlement, type GroupMember, type BalanceMap, type DebtInstruction, ZERO, money } from '../types';
import { add, negate, isPositive, isNegative, abs, subtract } from '../money';

/**
 * Computes the net balance for every member of a group from the full
 * expense and settlement history.
 *
 * For each expense:
 *   payer gets CREDIT of totalAmount   (they fronted the cash)
 *   each participant gets DEBIT of their split amount
 *
 * For each settlement:
 *   sender gets CREDIT of amount       (they paid someone back)
 *   receiver gets DEBIT of amount
 *
 * Result per user:
 *   positive → others owe this user money
 *   negative → this user owes others money
 *
 * Invariant: sum of all balances === 0  (zero-sum property)
 */
export const calculateGroupBalances = (
  expenses: readonly Expense[],
  settlements: readonly Settlement[],
  members: readonly GroupMember[],
): BalanceMap => {
  const balances = new Map<UserId, Money>();

  // Initialise every member at zero — map is complete even for members
  // who have no expenses or settlements yet.
  for (const member of members) {
    balances.set(member.userId, ZERO);
  }

  const adjust = (userId: UserId, delta: Money): void => {
    const current = balances.get(userId) ?? ZERO;
    balances.set(userId, add(current, delta));
  };

  for (const expense of expenses) {
    adjust(expense.paidBy, expense.totalAmount);  // payer credited
    for (const split of expense.splits) {
      adjust(split.userId, negate(split.amount)); // each participant debited
    }
  }

  for (const settlement of settlements) {
    adjust(settlement.fromUserId, settlement.amount);          // sender credited
    adjust(settlement.toUserId,   negate(settlement.amount));  // receiver debited
  }

  return balances;
};

/**
 * Reduces a BalanceMap to the minimum number of payment instructions
 * needed to settle all debts.
 *
 * Uses a greedy algorithm: repeatedly match the largest creditor with the
 * largest debtor. Minimises transaction count for groups of 2–10 people.
 *
 * Returns an empty array when all balances are zero.
 */
export const simplifyDebts = (balances: BalanceMap): DebtInstruction[] => {
  const creditors: Array<{ userId: UserId; amount: Money }> = [];
  const debtors:   Array<{ userId: UserId; amount: Money }> = [];

  for (const [userId, balance] of balances) {
    if (isPositive(balance)) creditors.push({ userId, amount: balance });
    if (isNegative(balance)) debtors.push({ userId, amount: abs(balance) });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const instructions: DebtInstruction[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor   = debtors[di]!;
    const amount   = money(Math.min(creditor.amount, debtor.amount));

    instructions.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amount });

    creditor.amount = subtract(creditor.amount, amount);
    debtor.amount   = subtract(debtor.amount,   amount);

    if (creditor.amount === ZERO) ci++;
    if (debtor.amount   === ZERO) di++;
  }

  return instructions;
};
