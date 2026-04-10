/**
 * features/friends/hooks/useAcceptInvite.ts
 *
 * TanStack Query mutation hook — accepts an invite token and creates
 * an accepted friendship. Invalidates ['friends'] on success.
 */

import { triggerGuestUpgradeReminderFromStore } from '@features/auth/hooks/useGuestUpgradeReminder';
import { friendRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => friendRepository.acceptInvite(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      triggerGuestUpgradeReminderFromStore();
    },
  });
}
