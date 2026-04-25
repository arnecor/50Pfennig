/**
 * features/groups/hooks/useGroups.ts
 *
 * TanStack Query hooks for group data.
 *
 * Exports:
 *   useGroups()       → all groups for the current user
 *   useGroup(groupId) → single group with members
 */

import type { Group, GroupId } from '@domain/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { groupDetailQueryOptions, groupsQueryOptions } from '../groupQueries';

/**
 * Fetches all groups and seeds each group's detail cache entry from the list
 * result. This ensures that group headers (name, avatar) are available offline
 * even when the user navigates directly to a group detail page without having
 * previously loaded it individually.
 */
export const useGroups = () => {
  const queryClient = useQueryClient();
  const query = useQuery(groupsQueryOptions());

  useEffect(() => {
    if (!query.data) return;
    for (const group of query.data) {
      queryClient.setQueryData<Group>(groupDetailQueryOptions(group.id).queryKey, (existing) => {
        // Only seed if the detail cache has no data — don't overwrite a fresher
        // individual fetch (e.g. from GroupDetailPage's own useGroup call).
        return existing ?? group;
      });
    }
  }, [query.data, queryClient]);

  return query;
};

export const useGroup = (groupId: GroupId) => useQuery(groupDetailQueryOptions(groupId));
