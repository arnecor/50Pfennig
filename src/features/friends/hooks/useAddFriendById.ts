/**
 * features/friends/hooks/useAddFriendById.ts
 *
 * TanStack Query mutation hook — creates an accepted friendship directly
 * by user ID (for the email search flow). Invalidates ['friends'] on success.
 */

import type { UserId } from '@domain/types';
import { triggerGuestUpgradeReminderFromStore } from '@features/auth/hooks/useGuestUpgradeReminder';
import { friendRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useAddFriendById() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: UserId) => friendRepository.addById(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      triggerGuestUpgradeReminderFromStore();
    },
  });
}
