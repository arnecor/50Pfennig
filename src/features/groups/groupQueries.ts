/**
 * features/groups/groupQueries.ts
 *
 * TanStack Query key factories and query option objects for group data.
 *
 * All query keys live here — never inline the key array in a hook.
 * This ensures consistent cache invalidation across the app.
 *
 * Query keys:
 *   ['groups']            → list of all groups for the current user
 *   ['groups', groupId]   → single group with full member list
 *
 * Loaders: route loaders in router/index.tsx call ensureQueryData()
 * with these options to prefetch before the component renders.
 */

import { queryOptions } from '@tanstack/react-query';
import { groupRepository } from '@repositories/index';
import type { GroupId } from '@domain/types';

export const groupsQueryOptions = () =>
  queryOptions({
    queryKey: ['groups'] as const,
    queryFn:  () => groupRepository.getAll(),
  });

export const groupDetailQueryOptions = (groupId: GroupId) =>
  queryOptions({
    queryKey: ['groups', groupId] as const,
    queryFn:  () => groupRepository.getById(groupId),
  });
