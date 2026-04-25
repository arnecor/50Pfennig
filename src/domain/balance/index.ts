/**
 * domain/balance/index.ts
 *
 * Balance derivation and debt simplification.
 *
 * Exports pure functions:
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
 *   computeBilateralBalance()
 *     Computes the net bilateral balance between two specific users.
 *     Only considers expenses where one of the two users paid.
 *     Third-party payers have no bilateral effect.
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

import { abs, add, isNegative, isPositive, negate, subtract } from '../money';
import {
  type BalanceMap,
  type DebtInstruction,
  type Expense,
  type GroupMember,
  type Money,
  type Settlement,
  type UserId,
  ZERO,
  isSameUser,
  money,
} from '../types';

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
    adjust(expense.paidBy, expense.baseTotalAmount); // payer credited in base currency
    for (const split of expense.splits) {
      adjust(split.userId, negate(split.amount)); // each participant debited (splits are in base currency)
    }
  }

  for (const settlement of settlements) {
    adjust(settlement.fromUserId, settlement.baseAmount); // sender credited in base currency
    adjust(settlement.toUserId, negate(settlement.baseAmount)); // receiver debited in base currency
  }

  return balances;
};

/**
 * Computes net balances from a flat list of friend expenses (no group context,
 * no member list). Participants are whoever appears in expense.splits.
 *
 * Used for the home-screen total balance and the future friends tab.
 * Settlements between friends can be passed as an optional second argument.
 */
export const calculateParticipantBalances = (
  expenses: readonly Expense[],
  settlements: readonly Settlement[] = [],
): BalanceMap => {
  const balances = new Map<UserId, Money>();

  const adjust = (userId: UserId, delta: Money): void => {
    const current = balances.get(userId) ?? ZERO;
    balances.set(userId, add(current, delta));
  };

  for (const expense of expenses) {
    adjust(expense.paidBy, expense.baseTotalAmount);
    for (const split of expense.splits) {
      adjust(split.userId, negate(split.amount));
    }
  }

  for (const settlement of settlements) {
    adjust(settlement.fromUserId, settlement.baseAmount);
    adjust(settlement.toUserId, negate(settlement.baseAmount));
  }

  return balances;
};

/**
 * Computes the net bilateral balance between two specific users across a set
 * of expenses and settlements.
 *
 * Only considers expenses where meId or friendId is the payer.
 * Third-party payers have no bilateral effect between the two users.
 *
 * Result:
 *   positive → friend owes me money
 *   negative → I owe friend money
 */
export const computeBilateralBalance = (
  expenses: readonly Expense[],
  settlements: readonly Settlement[],
  meId: UserId,
  friendId: UserId,
): Money => {
  let balance: Money = ZERO;

  for (const e of expenses) {
    if (isSameUser(e.paidBy, meId)) {
      // I paid — friend's split is their debt to me
      const friendSplit = e.splits.find((s) => isSameUser(s.userId, friendId))?.amount ?? ZERO;
      balance = add(balance, friendSplit);
    } else if (isSameUser(e.paidBy, friendId)) {
      // Friend paid — my split is my debt to friend
      const mySplit = e.splits.find((s) => isSameUser(s.userId, meId))?.amount ?? ZERO;
      balance = subtract(balance, mySplit);
    }
    // Third party paid — no bilateral effect between me and friend
  }

  for (const s of settlements) {
    if (isSameUser(s.fromUserId, friendId) && isSameUser(s.toUserId, meId)) {
      // Friend paid me — friend's debt decreases
      balance = subtract(balance, s.baseAmount);
    } else if (isSameUser(s.fromUserId, meId) && isSameUser(s.toUserId, friendId)) {
      // I paid friend — my debt to friend decreases
      balance = add(balance, s.baseAmount);
    }
  }

  return balance;
};

/**
 * Extracts the net simplified debt between two specific users from a set of
 * already-computed DebtInstructions (output of simplifyDebts).
 *
 * Used to derive what a specific friend owes the current user within a single
 * group context, after the greedy simplification has been applied.
 *
 * Result:
 *   positive → friend owes me money (instruction goes friend → me)
 *   negative → I owe friend money   (instruction goes me → friend)
 *   zero     → no direct instruction exists between the pair in this context
 *
 * Sign convention matches computeBilateralBalance.
 */
export const extractSimplifiedDebt = (
  instructions: readonly DebtInstruction[],
  meId: UserId,
  friendId: UserId,
): Money => {
  let balance: Money = ZERO;

  for (const inst of instructions) {
    if (isSameUser(inst.fromUserId, friendId) && isSameUser(inst.toUserId, meId)) {
      // Friend pays me — friend's debt to me increases
      balance = add(balance, inst.amount);
    } else if (isSameUser(inst.fromUserId, meId) && isSameUser(inst.toUserId, friendId)) {
      // I pay friend — my debt to friend increases
      balance = subtract(balance, inst.amount);
    }
    // Instructions not involving both users are ignored
  }

  return balance;
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
  const debtors: Array<{ userId: UserId; amount: Money }> = [];

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
    // biome-ignore lint/style/noNonNullAssertion: while condition proves ci/di are in bounds
    const creditor = creditors[ci]!;
    // biome-ignore lint/style/noNonNullAssertion: while condition proves ci/di are in bounds
    const debtor = debtors[di]!;
    const amount = money(Math.min(creditor.amount, debtor.amount));

    instructions.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amount });

    creditor.amount = subtract(creditor.amount, amount);
    debtor.amount = subtract(debtor.amount, amount);

    if (creditor.amount === ZERO) ci++;
    if (debtor.amount === ZERO) di++;
  }

  return instructions;
};
