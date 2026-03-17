/**
 * features/friends/hooks/useCreateInvite.ts
 *
 * TanStack Query mutation hook — creates a shareable invite token.
 * Returns a FriendInvite with the token and expiry date.
 */

import { friendRepository } from '@repositories';
import { useMutation } from '@tanstack/react-query';

export function useCreateInvite() {
  return useMutation({
    mutationFn: () => friendRepository.createInvite(),
  });
}
