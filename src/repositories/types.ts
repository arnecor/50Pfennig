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
  Expense,
  ExpenseId,
  ExpenseSplit,
  Friend,
  FriendshipId,
  Group,
  GroupId,
  GroupMember,
  Money,
  Settlement,
  SettlementId,
  UserId,
} from '../domain/types';

// ---------------------------------------------------------------------------
// Group repository
// ---------------------------------------------------------------------------

export type CreateGroupInput = {
  name: string;
  memberIds: UserId[];
};

export interface IGroupRepository {
  /** All groups the current user is a member of */
  getAll(): Promise<Group[]>;

  /** Single group with its members */
  getById(id: GroupId): Promise<Group>;

  /** Create a group and add the current user as the first member */
  create(input: CreateGroupInput): Promise<Group>;

  /** Add a user to an existing group */
  addMember(groupId: GroupId, userId: UserId): Promise<GroupMember>;

  /** Remove a user from a group */
  removeMember(groupId: GroupId, userId: UserId): Promise<void>;
}

// ---------------------------------------------------------------------------
// Friend repository
// ---------------------------------------------------------------------------

export interface IFriendRepository {
  /** All accepted friends of the current user, with their display names. */
  getAll(): Promise<Friend[]>;

  /** Remove a friendship by its ID. Both parties may call this. */
  remove(friendshipId: FriendshipId): Promise<void>;
}

// ---------------------------------------------------------------------------
// Expense repository
// ---------------------------------------------------------------------------

export type CreateExpenseInput = {
  groupId: GroupId | null; // null = friend expense (not in a group)
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
   * All friend expenses (group_id IS NULL) where the current user is a participant.
   * RLS on the DB side limits visibility to only expenses the user is part of.
   */
  getByParticipant(): Promise<Expense[]>;

  /**
   * All expenses (friend and group) that both the current user and otherUserId
   * are participants in, ordered newest first.
   * Used for the friend detail page.
   */
  getSharedWithUser(otherUserId: UserId): Promise<Expense[]>;

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
  groupId: GroupId | null; // null = friend settlement (not in a group)
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
