/**
 * lib/supabase/mappers.ts
 *
 * Conversion functions between Supabase database rows and domain types.
 *
 * Why this exists:
 *   The database uses snake_case column names and stores dates as ISO strings.
 *   The domain uses camelCase and native Date objects.
 *   This file is the single place where that translation happens.
 *
 * Pattern:
 *   Each mapper is a pure function: DbRow → DomainType
 *   Mappers never call the database — they only transform shapes.
 *
 * Imported by: repositories/supabase/*
 * Imports from: domain/types, lib/supabase/types.gen.ts
 */

import type { Database, Json } from './types.gen';
import {
  money,
  type Group,
  type GroupMember,
  type Expense,
  type Settlement,
  type ExpenseSplit,
  type ExpenseSplitRecord,
  type GroupId,
  type UserId,
  type ExpenseId,
  type SettlementId,
} from '../../domain/types';

// ---------------------------------------------------------------------------
// Row type aliases (shorthand for use within this file)
// ---------------------------------------------------------------------------

type GroupRow        = Database['public']['Tables']['groups']['Row'];
type GroupMemberRow  = Database['public']['Tables']['group_members']['Row'];
type ExpenseRow      = Database['public']['Tables']['expenses']['Row'];
type ExpenseSplitRow = Database['public']['Tables']['expense_splits']['Row'];
type SettlementRow   = Database['public']['Tables']['settlements']['Row'];

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export const mapGroupMember = (row: GroupMemberRow): GroupMember => ({
  userId:      row.user_id   as UserId,
  groupId:     row.group_id  as GroupId,
  displayName: row.display_name,
  joinedAt:    new Date(row.joined_at),
});

export const mapGroup = (row: GroupRow, members: GroupMemberRow[]): Group => ({
  id:        row.id         as GroupId,
  name:      row.name,
  createdBy: row.created_by as UserId,
  createdAt: new Date(row.created_at),
  members:   members.map(mapGroupMember),
});

export const mapExpenseSplitRecord = (row: ExpenseSplitRow): ExpenseSplitRecord => ({
  userId: row.user_id as UserId,
  amount: money(row.amount),
});

/**
 * Maps a raw DB expense row + its split rows to the domain Expense type.
 *
 * The `split_config` JSON is cast to ExpenseSplit — it was validated when the
 * expense was created (the RPC checks the split_type and config shape).
 */
export const mapExpense = (row: ExpenseRow, splitRows: ExpenseSplitRow[]): Expense => ({
  id:          row.id          as ExpenseId,
  groupId:     row.group_id    as GroupId,
  description: row.description,
  totalAmount: money(row.total_amount),
  paidBy:      row.paid_by     as UserId,
  split:       row.split_config as unknown as ExpenseSplit,
  splits:      splitRows.map(mapExpenseSplitRecord),
  createdBy:   row.created_by  as UserId,
  createdAt:   new Date(row.created_at),
  updatedAt:   new Date(row.updated_at),
});

export const mapSettlement = (row: SettlementRow): Settlement => ({
  id:          row.id           as SettlementId,
  groupId:     row.group_id     as GroupId,
  fromUserId:  row.from_user_id as UserId,
  toUserId:    row.to_user_id   as UserId,
  amount:      money(row.amount),
  ...(row.note != null ? { note: row.note } : {}),
  createdAt:   new Date(row.created_at),
});

// ---------------------------------------------------------------------------
// Serialisers: domain → DB insert shapes (for RPC calls)
// ---------------------------------------------------------------------------

/** Converts an ExpenseSplit to the JSON payload expected by the RPC. */
export const serialiseSplitConfig = (split: ExpenseSplit): Json =>
  split as unknown as Json;

/** Converts split records to the [{user_id, amount}] array the RPC expects. */
export const serialiseSplits = (
  splits: ReadonlyArray<{ userId: UserId; amount: number }>,
): Json =>
  splits.map(s => ({ user_id: s.userId, amount: s.amount })) as Json;
