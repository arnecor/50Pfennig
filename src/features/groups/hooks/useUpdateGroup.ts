/**
 * features/groups/hooks/useUpdateGroup.ts
 *
 * TanStack Query mutation hook for updating a group's name and/or image.
 * Any group member may call this (RLS: members can update).
 */

import type { Group, GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import type { UpdateGroupInput } from '@repositories/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, input }: { groupId: GroupId; input: UpdateGroupInput }) =>
      groupRepository.update(groupId, input),
    onSuccess: (updatedGroup: Group, { groupId }) => {
      // Seed caches immediately so the UI reflects the rename/image change
      // without waiting for a background refetch.
      queryClient.setQueryData<Group[]>(['groups'], (old) =>
        old ? old.map((g) => (g.id === groupId ? updatedGroup : g)) : [],
      );
      queryClient.setQueryData(['groups', groupId], updatedGroup);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
  });
};
