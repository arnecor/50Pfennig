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

import { supabase } from '../../lib/supabase/client';
import { mapExpense, serialiseSplitConfig, serialiseSplits } from '../../lib/supabase/mappers';
import { splitExpense } from '../../domain/splitting';
import { money, type ExpenseSplit, type UserId } from '../../domain/types';
import type { IExpenseRepository, CreateExpenseInput, UpdateExpenseInput } from '../types';
import type { Expense, ExpenseId, GroupId } from '../../domain/types';

export class SupabaseExpenseRepository implements IExpenseRepository {
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

  async create(input: CreateExpenseInput): Promise<Expense> {
    // Compute the per-user split snapshot using the domain algorithm.
    // This snapshot is stored in expense_splits and is immutable history.
    const splitAmounts = splitExpense(input.totalAmount, input.participants, input.split);
    const splits = input.participants.map(userId => ({
      userId,
      amount: splitAmounts[userId],
    }));

    // Write expense + splits atomically in one Postgres transaction.
    const { data: expenseRow, error } = await supabase.rpc('create_expense', {
      p_group_id:     input.groupId,
      p_description:  input.description,
      p_total_amount: input.totalAmount,
      p_paid_by:      input.paidBy,
      p_split_type:   input.split.type,
      p_split_config: serialiseSplitConfig(input.split),
      p_splits:       serialiseSplits(splits),
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
    const totalAmount  = input.totalAmount  ?? money(current.total_amount);
    const split        = input.split        ?? (current.split_config as unknown as ExpenseSplit);
    const paidBy       = input.paidBy       ?? (current.paid_by as UserId);
    const description  = input.description  ?? current.description;
    const participants = input.participants  ?? currentSplits.map(s => s.user_id as UserId);

    // Recompute the split snapshot.
    const splitAmounts = splitExpense(totalAmount, participants, split);
    const splits = participants.map(userId => ({
      userId,
      amount: splitAmounts[userId],
    }));

    // Write atomically — deletes old splits and inserts new ones in one transaction.
    const { data: expenseRow, error } = await supabase.rpc('update_expense', {
      p_expense_id:   id,
      p_description:  description,
      p_total_amount: totalAmount,
      p_paid_by:      paidBy,
      p_split_type:   split.type,
      p_split_config: serialiseSplitConfig(split),
      p_splits:       serialiseSplits(splits),
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
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
