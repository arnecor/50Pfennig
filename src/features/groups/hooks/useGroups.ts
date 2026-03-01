/**
 * features/groups/hooks/useGroups.ts
 *
 * TanStack Query hooks for group data.
 *
 * Exports:
 *   useGroups()       → all groups for the current user
 *   useGroup(groupId) → single group with members
 */

import { useQuery } from '@tanstack/react-query';
import { groupsQueryOptions, groupDetailQueryOptions } from '../groupQueries';
import type { GroupId } from '@domain/types';

export const useGroups = () => useQuery(groupsQueryOptions());

export const useGroup = (groupId: GroupId) =>
  useQuery(groupDetailQueryOptions(groupId));
