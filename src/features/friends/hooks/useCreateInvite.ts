/**
 * features/friends/hooks/useCreateInvite.ts
 *
 * TanStack Query mutation hook — creates a shareable invite token.
 * Returns a FriendInvite with the token and expiry date.
 */

import { useMutation } from '@tanstack/react-query';
import { friendRepository } from '@repositories';

export function useCreateInvite() {
  return useMutation({
    mutationFn: () => friendRepository.createInvite(),
  });
}
