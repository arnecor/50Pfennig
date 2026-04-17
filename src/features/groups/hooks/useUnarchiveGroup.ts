/**
 * features/groups/hooks/useUnarchiveGroup.ts
 *
 * TanStack Query mutation hook for reactivating an archived group.
 *
 * Calls the unarchive_group RPC which sets is_archived = false and archived_at = NULL.
 * Any group member may call this; anonymous users are gated at the UI level.
 * On success, invalidates the groups list and the group detail cache.
 */

import type { GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useUnarchiveGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: GroupId) => groupRepository.unarchiveGroup(groupId),
    onSuccess: (_data, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
  });
};
