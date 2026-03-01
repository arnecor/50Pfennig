/**
 * features/expenses/hooks/useExpenses.ts
 *
 * TanStack Query hooks for expense data.
 *
 * Exports:
 *   useExpenses(groupId)  → all expenses for a group
 */

import type { GroupId } from '@domain/types';
import { useQuery } from '@tanstack/react-query';
import { expensesQueryOptions } from '../expenseQueries';

export const useExpenses = (groupId: GroupId) => useQuery(expensesQueryOptions(groupId));
