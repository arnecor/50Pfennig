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

import type { CurrencyCode, Group, UserId } from '@domain/types';
import { triggerGuestUpgradeReminderFromStore } from '@features/auth/hooks/useGuestUpgradeReminder';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type CreateGroupInput = {
  name: string;
  memberIds?: UserId[];
  baseCurrency?: CurrencyCode;
  defaultCurrency?: CurrencyCode;
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, memberIds, baseCurrency, defaultCurrency }: CreateGroupInput) =>
      groupRepository.create({ name, memberIds: memberIds ?? [], baseCurrency, defaultCurrency }),
    onSuccess: (newGroup: Group) => {
      // Immediately seed the list cache so any consumer that mounts before the
      // background refetch lands (e.g. ExpenseForm preselection) already sees
      // the new group — avoids a race between navigation and cache invalidation.
      queryClient.setQueryData<Group[]>(['groups'], (old) =>
        old ? [...old, newGroup] : [newGroup],
      );
      // Seed the detail cache so GroupDetailPage doesn't show a loading flash.
      queryClient.setQueryData(['groups', newGroup.id], newGroup);
      // Invalidate to keep the server as the source of truth on next fetch.
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      triggerGuestUpgradeReminderFromStore();
    },
  });
};
