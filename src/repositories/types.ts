/**
 * repositories/types.ts
 *
 * Repository interfaces — the contract between features and data access.
 *
 * Features ONLY talk to these interfaces, never to Supabase directly.
 * This is the abstraction boundary that makes the sync backend swappable
 * (e.g. Supabase today, PowerSync tomorrow) without touching feature code.
 * See ADR-0005.
 *
 * Rules:
 * - Interfaces use domain types exclusively (no DB row types here)
 * - All methods are async (return Promise)
 * - Input types (Create*, Update*) are defined alongside each interface
 */

import type {
  Group, GroupId, GroupMember,
  Expense, ExpenseId, ExpenseSplit,
  Settlement, SettlementId,
  UserId, Money,
} from '../domain/types';

// ---------------------------------------------------------------------------
// Group repository
// ---------------------------------------------------------------------------

export type CreateGroupInput = {
  name: string;
};

export interface IGroupRepository {
  /** All groups the current user is a member of */
  getAll(): Promise<Group[]>;

  /** Single group with its members */
  getById(id: GroupId): Promise<Group>;

  /** Create a group and add the current user as the first member */
  create(input: CreateGroupInput): Promise<Group>;

  /** Add a user to an existing group */
  addMember(groupId: GroupId, userId: UserId, displayName: string): Promise<GroupMember>;

  /** Remove a user from a group */
  removeMember(groupId: GroupId, userId: UserId): Promise<void>;
}

// ---------------------------------------------------------------------------
// Expense repository
// ---------------------------------------------------------------------------

export type CreateExpenseInput = {
  groupId: GroupId;
  description: string;
  totalAmount: Money;
  paidBy: UserId;
  split: ExpenseSplit;
  participants: UserId[];
};

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, 'groupId'>>;

export interface IExpenseRepository {
  /** All expenses for a group, newest first */
  getByGroupId(groupId: GroupId): Promise<Expense[]>;

  /**
   * Create an expense and its splits atomically.
   * Calls the create_expense Postgres RPC — never two separate inserts.
   * See ADR-0006.
   */
  create(input: CreateExpenseInput): Promise<Expense>;

  /**
   * Update an expense and replace all splits atomically.
   * Calls the update_expense Postgres RPC.
   */
  update(id: ExpenseId, input: UpdateExpenseInput): Promise<Expense>;

  /** Delete an expense and its splits (cascade) */
  delete(id: ExpenseId): Promise<void>;
}

// ---------------------------------------------------------------------------
// Settlement repository
// ---------------------------------------------------------------------------

export type CreateSettlementInput = {
  groupId: GroupId;
  fromUserId: UserId;
  toUserId: UserId;
  amount: Money;
  note?: string;
};

export interface ISettlementRepository {
  /** All settlements for a group, newest first */
  getByGroupId(groupId: GroupId): Promise<Settlement[]>;

  /** Record a settlement (person A paid person B back) */
  create(input: CreateSettlementInput): Promise<Settlement>;

  /** Delete a settlement */
  delete(id: SettlementId): Promise<void>;
}
