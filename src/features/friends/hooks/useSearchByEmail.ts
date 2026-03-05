/**
 * features/friends/hooks/useSearchByEmail.ts
 *
 * TanStack Query mutation hook — searches for a registered user by email.
 * Returns an EmailSearchResult or null if not found.
 */

import { useMutation } from '@tanstack/react-query';
import { friendRepository } from '@repositories';

export function useSearchByEmail() {
  return useMutation({
    mutationFn: (email: string) => friendRepository.searchByEmail(email),
  });
}
