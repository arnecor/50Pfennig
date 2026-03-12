/**
 * features/settlements/hooks/useDeleteSettlement.ts
 *
 * TanStack Query mutation hook for deleting a settlement.
 *
 * Batch settlements (batchId != null) must be deleted all-or-nothing via
 * deleteBatch (ADR-0012). Single legacy settlements use delete by ID.
 *
 * The caller passes ALL records that belong to the payment (the full batch)
 * so the hook can invalidate every affected query key. For a non-batch
 * settlement, pass a single-element array.
 *
 * Invalidation after success (derived from all records):
 *   ['settlements', groupId]       — for each distinct groupId in the batch
 *   ['settlements', 'participant'] — if any record has groupId null
 *   ['settlements', 'shared', userId] — for both parties
 */

import type { Settlement } from '@domain/types';
import { settlementRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useDeleteSettlement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (records: Settlement[]) => {
      const first = records[0];
      if (!first) return Promise.resolve();

      if (first.batchId != null) {
        return settlementRepository.deleteBatch(first.batchId);
      }
      return settlementRepository.delete(first.id);
    },

    onSuccess: (_data, records) => {
      const invalidatedGroups = new Set<string>();

      for (const s of records) {
        if (s.groupId != null) {
          const key = String(s.groupId);
          if (!invalidatedGroups.has(key)) {
            invalidatedGroups.add(key);
            queryClient.invalidateQueries({ queryKey: ['settlements', s.groupId] });
          }
        } else {
          if (!invalidatedGroups.has('participant')) {
            invalidatedGroups.add('participant');
            queryClient.invalidateQueries({ queryKey: ['settlements', 'participant'] });
          }
        }
      }

      // Both parties — use first record (all share same fromUserId/toUserId)
      const first = records[0];
      if (first) {
        queryClient.invalidateQueries({ queryKey: ['settlements', 'shared', first.fromUserId] });
        queryClient.invalidateQueries({ queryKey: ['settlements', 'shared', first.toUserId] });
      }
    },
  });
};
