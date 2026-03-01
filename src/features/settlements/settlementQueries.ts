/**
 * features/settlements/settlementQueries.ts
 *
 * TanStack Query key factories and query option objects for settlement data.
 *
 * Query keys:
 *   ['settlements', groupId]  → all settlements for a group
 *
 * Invalidation: after any settlement mutation, invalidate ['settlements', groupId].
 * Balance display updates automatically (derives from expense + settlement cache).
 */

import { queryOptions } from '@tanstack/react-query';
import { settlementRepository } from '@repositories';
import type { GroupId } from '@domain/types';

export const settlementsQueryOptions = (groupId: GroupId) =>
  queryOptions({
    queryKey: ['settlements', groupId] as const,
    queryFn: () => settlementRepository.getByGroupId(groupId),
  });
