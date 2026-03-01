/**
 * features/expenses/hooks/useExpenses.ts
 *
 * TanStack Query hooks for expense data.
 *
 * Exports:
 *   useExpenses(groupId)  → all expenses for a group
 */

import { useQuery } from '@tanstack/react-query';
import { expensesQueryOptions } from '../expenseQueries';
import type { GroupId } from '@domain/types';

export const useExpenses = (groupId: GroupId) =>
  useQuery(expensesQueryOptions(groupId));
