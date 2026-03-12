/**
 * features/settlements/settlementQueries.ts
 *
 * TanStack Query key factories and query option objects for settlement data.
 *
 * Query keys:
 *   ['settlements', groupId]        → all settlements for a group
 *   ['settlements', 'participant']   → friend settlements (group_id IS NULL)
 *   ['settlements', 'shared', userId] → all settlements with a specific user (any group_id)
 *
 * Invalidation: after any settlement mutation, invalidate the relevant keys.
 * Balance display updates automatically (derives from expense + settlement cache).
 */

import type { GroupId, UserId } from '@domain/types';
import { settlementRepository } from '@repositories';
import { queryOptions } from '@tanstack/react-query';

export const settlementsQueryOptions = (groupId: GroupId) =>
  queryOptions({
    queryKey: ['settlements', groupId] as const,
    queryFn: () => settlementRepository.getByGroupId(groupId),
  });

export const friendSettlementsQueryOptions = () =>
  queryOptions({
    queryKey: ['settlements', 'participant'] as const,
    queryFn: () => settlementRepository.getByParticipant(),
  });

/** All settlements between the current user and a specific user (any group_id). */
export const sharedSettlementsQueryOptions = (userId: UserId) =>
  queryOptions({
    queryKey: ['settlements', 'shared', userId] as const,
    queryFn: () => settlementRepository.getSharedWithUser(userId),
  });
