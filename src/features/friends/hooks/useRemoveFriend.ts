/**
 * features/friends/hooks/useRemoveFriend.ts
 *
 * TanStack Query mutation hook — removes an accepted friendship.
 *
 * Invalidates ['friends'] on success so the friends list refreshes.
 */

import type { FriendshipId } from '@domain/types';
import { friendRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: FriendshipId) => friendRepository.remove(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}
