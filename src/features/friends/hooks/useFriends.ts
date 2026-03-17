/**
 * features/friends/hooks/useFriends.ts
 *
 * TanStack Query hook — fetches all accepted friends of the current user.
 *
 * Query key: ['friends']
 * Invalidate this key whenever a friendship is created or updated.
 */

import { friendRepository } from '@repositories';
import { useQuery } from '@tanstack/react-query';

export const friendsQueryOptions = () => ({
  queryKey: ['friends'] as const,
  queryFn: () => friendRepository.getAll(),
});

export function useFriends() {
  return useQuery(friendsQueryOptions());
}
