/**
 * features/friends/hooks/useRemoveFriend.ts
 *
 * TanStack Query mutation hook — removes an accepted friendship.
 *
 * Invalidates ['friends'] on success so the friends list refreshes.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendRepository } from '@repositories';
import type { FriendshipId } from '@domain/types';

export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: FriendshipId) => friendRepository.remove(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}
