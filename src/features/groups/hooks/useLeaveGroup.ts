/**
 * features/groups/hooks/useLeaveGroup.ts
 *
 * TanStack Query mutation hook for leaving a group.
 *
 * Calls leave_group RPC (atomic: removes group_members row + writes
 * 'member_left' event). On success, invalidates the groups list and
 * the group's event cache so the GroupDetailPage feed reflects the change.
 */

import type { GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useLeaveGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: GroupId) => groupRepository.leaveGroup(groupId),
    onSuccess: (_data, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'events'] });
    },
  });
};
