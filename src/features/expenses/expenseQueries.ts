/**
 * features/expenses/expenseQueries.ts
 *
 * TanStack Query key factories and query option objects for expense data.
 *
 * Query keys:
 *   ['expenses', groupId]  → all expenses for a group
 *
 * Invalidation: after any expense mutation, invalidate ['expenses', groupId].
 * The balance display (features/balances/) will automatically update
 * because it derives from the same cached expense data.
 */

import type { GroupId } from '@domain/types';
import { expenseRepository } from '@repositories';
import { queryOptions } from '@tanstack/react-query';

export const expensesQueryOptions = (groupId: GroupId) =>
  queryOptions({
    queryKey: ['expenses', groupId] as const,
    queryFn: () => expenseRepository.getByGroupId(groupId),
  });
