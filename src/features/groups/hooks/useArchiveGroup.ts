/**
 * features/groups/hooks/useArchiveGroup.ts
 *
 * TanStack Query mutation hook for archiving a group.
 *
 * Calls the archive_group RPC which sets is_archived = true and archived_at = NOW().
 * Any group member may call this; anonymous users are gated at the UI level.
 * On success, invalidates the groups list and the group detail cache.
 */

import type { GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useArchiveGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: GroupId) => groupRepository.archiveGroup(groupId),
    onSuccess: (_data, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
  });
};
