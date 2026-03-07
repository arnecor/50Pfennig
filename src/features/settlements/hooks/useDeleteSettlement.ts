import type { GroupId, SettlementId } from '@domain/types';
import { settlementRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useDeleteSettlement = (groupId: GroupId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settlementId: SettlementId) => settlementRepository.delete(settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};
