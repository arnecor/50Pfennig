/**
 * features/friends/hooks/useAddFriendById.ts
 *
 * TanStack Query mutation hook — creates an accepted friendship directly
 * by user ID (for the email search flow). Invalidates ['friends'] on success.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendRepository } from '@repositories';
import type { UserId } from '@domain/types';

export function useAddFriendById() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: UserId) => friendRepository.addById(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}
