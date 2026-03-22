/**
 * features/groups/hooks/useAddGroupMembers.ts
 *
 * TanStack Query mutation hook for adding one or more members to a group.
 *
 * Each userId is added in parallel. On success, the group detail cache
 * and the group list cache are both invalidated so member counts refresh.
 */

import type { GroupId, UserId } from '@domain/types';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type AddMembersInput = {
  groupId: GroupId;
  userIds: UserId[];
};

export const useAddGroupMembers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, userIds }: AddMembersInput) =>
      Promise.all(userIds.map((userId) => groupRepository.addMember(groupId, userId))),
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'events'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};
