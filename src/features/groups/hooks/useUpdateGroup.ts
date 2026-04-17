/**
 * features/groups/hooks/useUpdateGroup.ts
 *
 * TanStack Query mutation hook for updating a group's name and/or image.
 * Any group member may call this (RLS: members can update).
 */

import type { GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import type { UpdateGroupInput } from '@repositories/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, input }: { groupId: GroupId; input: UpdateGroupInput }) =>
      groupRepository.update(groupId, input),
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
  });
};
