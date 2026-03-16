/**
 * features/friends/hooks/useSearchByEmail.ts
 *
 * TanStack Query mutation hook — searches for a registered user by email.
 * Returns an EmailSearchResult or null if not found.
 */

import { friendRepository } from '@repositories';
import { useMutation } from '@tanstack/react-query';

export function useSearchByEmail() {
  return useMutation({
    mutationFn: (email: string) => friendRepository.searchByEmail(email),
  });
}
