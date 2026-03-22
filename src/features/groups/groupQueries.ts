/**
 * features/groups/groupQueries.ts
 *
 * TanStack Query key factories and query option objects for group data.
 *
 * All query keys live here — never inline the key array in a hook.
 * This ensures consistent cache invalidation across the app.
 *
 * Query keys:
 *   ['groups']                    → list of all groups for the current user
 *   ['groups', groupId]           → single group with full member list
 *   ['groups', groupId, 'events'] → lifecycle events for the group
 */

import type { GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import { queryOptions } from '@tanstack/react-query';

export const groupsQueryOptions = () =>
  queryOptions({
    queryKey: ['groups'] as const,
    queryFn: () => groupRepository.getAll(),
  });

export const groupDetailQueryOptions = (groupId: GroupId) =>
  queryOptions({
    queryKey: ['groups', groupId] as const,
    queryFn: () => groupRepository.getById(groupId),
  });

export const groupEventsQueryOptions = (groupId: GroupId) =>
  queryOptions({
    queryKey: ['groups', groupId, 'events'] as const,
    queryFn: () => groupRepository.getEvents(groupId),
  });
