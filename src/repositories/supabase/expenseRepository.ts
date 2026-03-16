/**
 * repositories/supabase/expenseRepository.ts
 *
 * Supabase implementation of IExpenseRepository.
 *
 * Critical: all expense writes go through the create_expense and
 * update_expense Postgres RPC functions — NEVER two separate inserts.
 * This ensures expenses and their splits are always written atomically.
 * See ADR-0006.
 *
 * The split algorithm (splitExpense from domain/splitting) is called here,
 * at write time, to compute the snapshot stored in expense_splits.
 * See ADR-0007.
 *
 * Imported by: repositories/index.ts (factory binding)
 */

import { splitExpense } from '../../domain/splitting';
import { type ExpenseSplit, type UserId, money } from '../../domain/types';
import type { Expense, ExpenseId, GroupId } from '../../domain/types';
import { supabase } from '../../lib/supabase/client';
import { mapExpense, serialiseSplitConfig, serialiseSplits } from '../../lib/supabase/mappers';
import type { CreateExpenseInput, IExpenseRepository, UpdateExpenseInput } from '../types';

export class SupabaseExpenseRepository implements IExpenseRepository {
  async getById(id: ExpenseId): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    const splits = (data as typeof data & { expense_splits: unknown[] }).expense_splits;
    return mapExpense(data, splits as never[]);
  }

  async getByGroupId(groupId: GroupId): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const splits = (row as typeof row & { expense_splits: unknown[] }).expense_splits;
      return mapExpense(row, splits as never[]);
    });
  }

  async getByParticipant(): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .is('group_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const splits = (row as typeof row & { expense_splits: unknown[] }).expense_splits;
      return mapExpense(row, splits as never[]);
    });
  }

  async create(input: CreateExpenseInput): Promise<Expense> {
    // Compute the per-user split snapshot using the domain algorithm.
    // This snapshot is stored in expense_splits and is immutable history.
    const splitAmounts = splitExpense(input.totalAmount, input.participants, input.split);
    const splits = input.participants.map((userId) => ({
      userId,
      // biome-ignore lint/style/noNonNullAssertion: splitExpense guarantees a value for every participant
      amount: splitAmounts[userId]!,
    }));

    // Write expense + splits atomically in one Postgres transaction.
    const { data: expenseRow, error } = await supabase.rpc('create_expense', {
      p_group_id: (input.groupId ?? null) as string, // null is valid; generated types don't reflect nullable param
      p_description: input.description,
      p_total_amount: input.totalAmount,
      p_paid_by: input.paidBy,
      p_split_type: input.split.type,
      p_split_config: serialiseSplitConfig(input.split),
      p_splits: serialiseSplits(splits),
    });

    if (error) throw error;

    // Fetch the persisted splits to build the full domain Expense.
    const { data: splitRows, error: splitError } = await supabase
      .from('expense_splits')
      .select('*')
      .eq('expense_id', expenseRow.id);

    if (splitError) throw splitError;

    return mapExpense(expenseRow, splitRows ?? []);
  }

  async update(id: ExpenseId, input: UpdateExpenseInput): Promise<Expense> {
    // Fetch the current expense so we can fill in any omitted fields.
    const { data: current, error: fetchError } = await supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const currentSplits = (
      current as typeof current & { expense_splits: Array<{ user_id: string }> }
    ).expense_splits;

    // Merge new values with current — only provided fields are updated.
    const totalAmount = input.totalAmount ?? money(current.total_amount);
    const split = input.split ?? (current.split_config as unknown as ExpenseSplit);
    const paidBy = input.paidBy ?? (current.paid_by as UserId);
    const description = input.description ?? current.description;
    const participants = input.participants ?? currentSplits.map((s) => s.user_id as UserId);

    // Recompute the split snapshot.
    const splitAmounts = splitExpense(totalAmount, participants, split);
    const splits = participants.map((userId) => ({
      userId,
      // biome-ignore lint/style/noNonNullAssertion: splitExpense guarantees a value for every participant
      amount: splitAmounts[userId]!,
    }));

    // Write atomically — deletes old splits and inserts new ones in one transaction.
    const { data: expenseRow, error } = await supabase.rpc('update_expense', {
      p_expense_id: id,
      p_description: description,
      p_total_amount: totalAmount,
      p_paid_by: paidBy,
      p_split_type: split.type,
      p_split_config: serialiseSplitConfig(split),
      p_splits: serialiseSplits(splits),
    });

    if (error) throw error;

    const { data: splitRows, error: splitError } = await supabase
      .from('expense_splits')
      .select('*')
      .eq('expense_id', expenseRow.id);

    if (splitError) throw splitError;

    return mapExpense(expenseRow, splitRows ?? []);
  }

  async delete(id: ExpenseId): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);

    if (error) throw error;
  }

  async getSharedWithUser(otherUserId: UserId): Promise<Expense[]> {
    // Fetch all expenses visible to the current user (RLS handles authorisation),
    // then filter client-side to those where otherUserId also participates.
    // For group expenses the full split list is visible (group member RLS).
    // For friend expenses we detect the other user via paid_by as a fallback
    // when their split row isn't directly visible.
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const otherIdStr = otherUserId as string;

    return (data ?? [])
      .filter((row) => {
        const splits = (row as typeof row & { expense_splits: Array<{ user_id: string }> })
          .expense_splits;
        return row.paid_by === otherIdStr || splits.some((s) => s.user_id === otherIdStr);
      })
      .map((row) => {
        const splits = (row as typeof row & { expense_splits: unknown[] }).expense_splits;
        return mapExpense(row, splits as never[]);
      });
  }
}
