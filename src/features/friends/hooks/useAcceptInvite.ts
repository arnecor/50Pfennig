/**
 * features/friends/hooks/useAcceptInvite.ts
 *
 * TanStack Query mutation hook — accepts an invite token and creates
 * an accepted friendship. Invalidates ['friends'] on success.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendRepository } from '@repositories';

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => friendRepository.acceptInvite(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}
