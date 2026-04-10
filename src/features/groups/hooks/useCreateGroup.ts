/**
 * features/groups/hooks/useCreateGroup.ts
 *
 * TanStack Query mutation hook for creating a new group.
 *
 * Flow:
 *   1. Call groupRepository.create({ name, memberIds }) which invokes the
 *      create_group Postgres RPC — group, creator membership, and any extra
 *      members are all inserted atomically in one transaction.
 *   2. Invalidate the ['groups'] query so GroupList refreshes automatically.
 *
 * Returns the newly created Group so the caller can navigate to its detail page.
 */

import type { UserId } from '@domain/types';
import { triggerGuestUpgradeReminderFromStore } from '@features/auth/hooks/useGuestUpgradeReminder';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type CreateGroupInput = {
  name: string;
  memberIds?: UserId[];
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, memberIds }: CreateGroupInput) =>
      groupRepository.create({ name, memberIds: memberIds ?? [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      triggerGuestUpgradeReminderFromStore();
    },
  });
};
