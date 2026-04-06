/**
 * features/groups/hooks/useAcceptGroupInvite.ts
 *
 * TanStack Query mutation hook — accepts a group invite token.
 * Adds the current user to the group, creates a friendship with the
 * invite creator, and navigates to the group detail page on success.
 */

import type { GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

export function useAcceptGroupInvite() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (token: string) => groupRepository.acceptGroupInvite(token),
    onSuccess: (groupId: GroupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      void navigate({ to: '/groups/$groupId', params: { groupId } });
    },
  });
}
