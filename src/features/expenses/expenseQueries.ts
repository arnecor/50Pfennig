/**
 * features/expenses/expenseQueries.ts
 *
 * TanStack Query key factories and query option objects for expense data.
 *
 * Query keys:
 *   ['expenses', groupId]      → all expenses for a group
 *   ['expenses', 'participant'] → all friend expenses for the current user
 *
 * Invalidation:
 *   Group expense mutation   → invalidate ['expenses', groupId]
 *   Friend expense mutation  → invalidate ['expenses', 'participant']
 *   Both invalidations cascade into useTotalBalance automatically.
 */

import type { GroupId, UserId } from '@domain/types';
import { expenseRepository } from '@repositories';
import { queryOptions } from '@tanstack/react-query';

export const expensesQueryOptions = (groupId: GroupId) =>
  queryOptions({
    queryKey: ['expenses', groupId] as const,
    queryFn: () => expenseRepository.getByGroupId(groupId),
  });

export const friendExpensesQueryOptions = () =>
  queryOptions({
    queryKey: ['expenses', 'participant'] as const,
    queryFn: () => expenseRepository.getByParticipant(),
  });

export const sharedExpensesQueryOptions = (friendUserId: UserId) =>
  queryOptions({
    queryKey: ['expenses', 'shared', friendUserId] as const,
    queryFn: () => expenseRepository.getSharedWithUser(friendUserId),
  });
