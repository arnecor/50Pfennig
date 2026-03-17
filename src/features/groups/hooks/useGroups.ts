/**
 * features/groups/hooks/useGroups.ts
 *
 * TanStack Query hooks for group data.
 *
 * Exports:
 *   useGroups()       → all groups for the current user
 *   useGroup(groupId) → single group with members
 */

import type { GroupId } from '@domain/types';
import { useQuery } from '@tanstack/react-query';
import { groupDetailQueryOptions, groupsQueryOptions } from '../groupQueries';

export const useGroups = () => useQuery(groupsQueryOptions());

export const useGroup = (groupId: GroupId) => useQuery(groupDetailQueryOptions(groupId));
