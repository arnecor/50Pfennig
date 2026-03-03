/**
 * features/groups/hooks/useCreateGroup.ts
 *
 * TanStack Query mutation hook for creating a new group and optionally
 * adding members in one shot.
 *
 * Flow:
 *   1. Create the group via groupRepository.create({ name })
 *   2. If memberIds are provided, add each in parallel via groupRepository.addMember()
 *   3. Invalidate the ['groups'] query so GroupList refreshes automatically
 *
 * Returns the newly created Group so the caller can navigate to its detail page.
 */

import type { GroupId, UserId } from '@domain/types';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type CreateGroupInput = {
  name: string;
  memberIds?: UserId[];
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, memberIds }: CreateGroupInput) => {
      const group = await groupRepository.create({ name });
      if (memberIds && memberIds.length > 0) {
        await Promise.all(
          memberIds.map((userId) => groupRepository.addMember(group.id as GroupId, userId)),
        );
      }
      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};
