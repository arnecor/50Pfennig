/**
 * features/settlements/hooks/useCreateSettlement.ts
 *
 * TanStack Query mutation hook for creating a settlement batch (ADR-0012).
 *
 * One real-world payment can span multiple accounting contexts (groups + direct).
 * The caller must pre-compute allocations via allocateSettlement() before calling.
 *
 * Invalidation after success:
 *   ['settlements', groupId]      — for each group allocation
 *   ['settlements', 'participant'] — if any allocation has groupId null
 *   ['settlements', 'shared', userId] — for the other user (both directions)
 */

import type { CreateSettlementBatchInput } from '@repositories/types';
import { settlementRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useCreateSettlement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSettlementBatchInput) =>
      settlementRepository.createBatch(input),

    onSuccess: (_data, input) => {
      const invalidated = new Set<string>();

      for (const alloc of input.allocations) {
        if (alloc.groupId != null) {
          const key = String(alloc.groupId);
          if (!invalidated.has(key)) {
            invalidated.add(key);
            queryClient.invalidateQueries({ queryKey: ['settlements', alloc.groupId] });
          }
        } else {
          if (!invalidated.has('participant')) {
            invalidated.add('participant');
            queryClient.invalidateQueries({ queryKey: ['settlements', 'participant'] });
          }
        }
      }

      // Invalidate the shared view for both parties
      queryClient.invalidateQueries({ queryKey: ['settlements', 'shared', input.fromUserId] });
      queryClient.invalidateQueries({ queryKey: ['settlements', 'shared', input.toUserId] });
    },
  });
};
