/**
 * domain/types.ts
 *
 * The single source of truth for all domain types in 50Pfennig.
 * Every other file in the project depends on this file.
 *
 * Rules:
 * - This file imports NOTHING outside src/domain/
 * - All domain entities live here (Group, Expense, Settlement, etc.)
 * - All branded primitive types live here (Money, UserId, GroupId, etc.)
 * - No persistence concerns, no framework concerns — pure data shapes
 */

// ---------------------------------------------------------------------------
// Branded primitive types
// Prevents accidentally passing a raw string where a UserId is expected, etc.
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type Money       = Brand<number, 'Money'>;       // always integer cents
export type UserId      = Brand<string, 'UserId'>;
export type GroupId     = Brand<string, 'GroupId'>;
export type ExpenseId   = Brand<string, 'ExpenseId'>;
export type SettlementId = Brand<string, 'SettlementId'>;

/** Construct a Money value. Throws if the value is not an integer. */
export const money = (cents: number): Money => {
  if (!Number.isInteger(cents)) {
    throw new Error(`Money must be an integer number of cents, got ${cents}`);
  }
  return cents as Money;
};

export const ZERO: Money = money(0);

// ---------------------------------------------------------------------------
// Expense split types (discriminated union)
// ---------------------------------------------------------------------------

/** Each participant pays an equal share. Remainders distributed by largest-remainder method. */
export type EqualSplit = {
  readonly type: 'equal';
};

/** Each participant's amount is specified explicitly. Amounts must sum to the total. */
export type ExactSplit = {
  readonly type: 'exact';
  readonly amounts: Readonly<Record<UserId, Money>>;
};

/**
 * Each participant's share is specified as basis points (1 bp = 0.01%).
 * Basis points must sum to exactly 10000 (= 100.00%).
 * Using basis points avoids floating-point comparison issues.
 * Example: 33.33% = 3333 bp, 33.33% = 3333 bp, 33.34% = 3334 bp → sum = 10000 ✓
 */
export type PercentageSplit = {
  readonly type: 'percentage';
  readonly basisPoints: Readonly<Record<UserId, number>>;
};

export type ExpenseSplit = EqualSplit | ExactSplit | PercentageSplit;

// ---------------------------------------------------------------------------
// Core domain entities
// ---------------------------------------------------------------------------

export type GroupMember = {
  readonly userId: UserId;
  readonly groupId: GroupId;
  readonly displayName: string;
  readonly joinedAt: Date;
};

export type Group = {
  readonly id: GroupId;
  readonly name: string;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly members: readonly GroupMember[];
};

/**
 * The per-user computed amount for a specific expense.
 *
 * This is the SNAPSHOT of the split algorithm output, stored at write time.
 * It is immutable financial history — not derived state.
 * See ADR-0007.
 */
export type ExpenseSplitRecord = {
  readonly userId: UserId;
  readonly amount: Money; // how much this user owes for this expense
};

export type Expense = {
  readonly id: ExpenseId;
  readonly groupId: GroupId;
  readonly description: string;
  readonly totalAmount: Money;
  readonly paidBy: UserId;          // who paid the full amount upfront
  readonly split: ExpenseSplit;     // the configuration (what rule was agreed)
  readonly splits: readonly ExpenseSplitRecord[]; // the computed snapshot (immutable)
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type Settlement = {
  readonly id: SettlementId;
  readonly groupId: GroupId;
  readonly fromUserId: UserId; // who paid (sent money)
  readonly toUserId: UserId;   // who received money
  readonly amount: Money;
  readonly note?: string;
  readonly createdAt: Date;
};

// ---------------------------------------------------------------------------
// Balance types — always derived, never stored (see ADR-0009)
// ---------------------------------------------------------------------------

/**
 * Maps each user in a group to their net balance.
 * Positive = others owe this user money.
 * Negative = this user owes others money.
 */
export type BalanceMap = Map<UserId, Money>;

/**
 * A single debt instruction: fromUserId must pay amount to toUserId.
 * Produced by simplifyDebts() to minimise the number of transactions needed.
 */
export type DebtInstruction = {
  readonly fromUserId: UserId;
  readonly toUserId: UserId;
  readonly amount: Money;
};
