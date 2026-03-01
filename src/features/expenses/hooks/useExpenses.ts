/**
 * features/expenses/hooks/useExpenses.ts
 *
 * TanStack Query hooks for expense data.
 *
 * Exports:
 *   useExpenses(groupId)        → all expenses for a group
 *   useCreateExpense()          → mutation: calls expenseRepository.create()
 *   useUpdateExpense()          → mutation: calls expenseRepository.update()
 *   useDeleteExpense()          → mutation: calls expenseRepository.delete()
 *
 * All mutations use optimistic updates:
 *   onMutate  → apply optimistic change to cache
 *   onError   → rollback to previous cache state
 *   onSettled → invalidate to refetch authoritative data
 */

import { useQuery } from '@tanstack/react-query';
import { expensesQueryOptions } from '../expenseQueries';
import type { GroupId } from '@domain/types';

export const useExpenses = (groupId: GroupId) =>
  useQuery(expensesQueryOptions(groupId));
