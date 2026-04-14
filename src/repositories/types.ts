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
  GroupEvent,
  GroupId,
  GroupInvite,
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

export type UpdateGroupInput = {
  /** New group name. Omit to leave unchanged. */
  name?: string;
  /** New image value. Pass null to reset to default icon. Omit to leave unchanged. */
  imageUrl?: string | null;
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

  /**
   * Leave a group atomically — removes caller from group_members and records
   * a 'member_left' event via the leave_group RPC.
   */
  leaveGroup(groupId: GroupId): Promise<void>;

  /** All lifecycle events for a group (joins, leaves), newest first */
  getEvents(groupId: GroupId): Promise<GroupEvent[]>;

  /**
   * Create or return an existing active invite token for the group.
   * Any group member may call this.
   */
  createGroupInvite(groupId: GroupId): Promise<GroupInvite>;

  /**
   * Accept a group invite token — adds the caller to the group and creates
   * a friendship with the token creator.
   * Returns the group ID so the caller can navigate to the group detail page.
   */
  acceptGroupInvite(token: string): Promise<GroupId>;

  /** Update group name and/or image. Any member may call this. */
  update(id: GroupId, input: UpdateGroupInput): Promise<Group>;

  /**
   * Upload a (pre-resized) image blob to storage, build a cache-busted public URL,
   * persist it on the group row, and return the updated Group.
   * Callers are responsible for resizing before calling this.
   */
  uploadImage(id: GroupId, file: Blob): Promise<Group>;
}

// ---------------------------------------------------------------------------
// Friend repository
// ---------------------------------------------------------------------------

export type FriendInvite = {
  readonly id: string;
  readonly token: string;
  readonly inviterId: UserId;
  readonly expiresAt: Date;
  readonly createdAt: Date;
};

export type EmailSearchResult = {
  readonly userId: UserId;
  readonly displayName: string;
  readonly email: string;
};

export interface IFriendRepository {
  /** All accepted friends of the current user, with their display names. */
  getAll(): Promise<Friend[]>;

  /** Remove a friendship by its ID. Both parties may call this. */
  remove(friendshipId: FriendshipId): Promise<void>;

  /** Create a shareable invite token (valid for 7 days). */
  createInvite(): Promise<FriendInvite>;

  /** Accept an invite token and create an accepted friendship. */
  acceptInvite(token: string): Promise<void>;

  /** Find a registered user by exact email match. Returns null if not found. */
  searchByEmail(email: string): Promise<EmailSearchResult | null>;

  /** Create an accepted friendship directly by user ID (for email search flow). */
  addById(userId: UserId): Promise<void>;
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
  /** Single expense by ID */
  getById(id: ExpenseId): Promise<Expense>;

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

/** Input for creating a settlement batch — one real-world payment split across contexts (ADR-0012) */
export type CreateSettlementBatchInput = {
  fromUserId: UserId;
  toUserId: UserId;
  note?: string;
  allocations: ReadonlyArray<{
    groupId: GroupId | null;
    fromUserId: UserId;
    toUserId: UserId;
    amount: Money;
  }>;
};

export interface ISettlementRepository {
  /** Single settlement by ID */
  getById(id: SettlementId): Promise<Settlement>;

  /** All settlements for a group, newest first */
  getByGroupId(groupId: GroupId): Promise<Settlement[]>;

  /**
   * All friend settlements (group_id IS NULL) where the current user is a party.
   * RLS limits visibility to only settlements the user is part of.
   */
  getByParticipant(): Promise<Settlement[]>;

  /**
   * All settlements between the current user and a specific user, across all
   * contexts (any group_id). Used for FriendDetailPage settlement history.
   */
  getSharedWithUser(userId: UserId): Promise<Settlement[]>;

  /** Record a settlement (person A paid person B back) */
  create(input: CreateSettlementInput): Promise<Settlement>;

  /**
   * Record a settlement batch — one real-world payment allocated across
   * multiple contexts atomically. See ADR-0012.
   */
  createBatch(input: CreateSettlementBatchInput): Promise<Settlement[]>;

  /** Delete a single settlement (non-batch) */
  delete(id: SettlementId): Promise<void>;

  /** Delete all settlement records in a batch atomically (ADR-0012) */
  deleteBatch(batchId: string): Promise<void>;
}
