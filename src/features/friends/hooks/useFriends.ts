/**
 * features/friends/hooks/useFriends.ts
 *
 * TanStack Query hook — fetches all accepted friends of the current user.
 *
 * Query key: ['friends']
 * Invalidate this key whenever a friendship is created or updated.
 */

import { useQuery } from '@tanstack/react-query';
import { friendRepository } from '@repositories';

export const friendsQueryOptions = () => ({
  queryKey: ['friends'] as const,
  queryFn:  () => friendRepository.getAll(),
});

export function useFriends() {
  return useQuery(friendsQueryOptions());
}
