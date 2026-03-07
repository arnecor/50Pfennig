import type { CreateSettlementInput } from '@repositories/types';
import { settlementRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useRecordSettlement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSettlementInput) => settlementRepository.create(input),
    onSuccess: (_data, input) => {
      if (input.groupId != null) {
        queryClient.invalidateQueries({ queryKey: ['settlements', input.groupId] });
      }
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};
