/**
 * features/groups/hooks/useArchiveGroup.ts
 *
 * TanStack Query mutation hook for archiving a group.
 *
 * Calls the archive_group RPC which sets is_archived = true and archived_at = NOW().
 * Any group member may call this; anonymous users are gated at the UI level.
 *
 * Uses optimistic update: the group is flipped to isArchived=true immediately in
 * both the list and detail caches. On error the previous state is restored.
 * archiveGroup() returns void so we cannot use the return value to seed caches —
 * optimistic update is the only way to get instant UI feedback.
 */

import type { Group, GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useArchiveGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: GroupId) => groupRepository.archiveGroup(groupId),
    onMutate: async (groupId) => {
      await queryClient.cancelQueries({ queryKey: ['groups', groupId] });

      const previousGroup = queryClient.getQueryData<Group>(['groups', groupId]);
      const now = new Date();

      queryClient.setQueryData<Group>(['groups', groupId], (old) =>
        old ? { ...old, isArchived: true, archivedAt: now } : old,
      );
      queryClient.setQueryData<Group[]>(['groups'], (old) =>
        old
          ? old.map((g) => (g.id === groupId ? { ...g, isArchived: true, archivedAt: now } : g))
          : [],
      );

      return { previousGroup };
    },
    onError: (_err, groupId, context) => {
      if (context?.previousGroup !== undefined) {
        queryClient.setQueryData(['groups', groupId], context.previousGroup);
      }
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onSuccess: (_data, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
  });
};
