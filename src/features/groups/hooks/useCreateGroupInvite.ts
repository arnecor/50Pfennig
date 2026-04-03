/**
 * features/groups/hooks/useCreateGroupInvite.ts
 *
 * TanStack Query mutation hook — creates or returns an existing active
 * shareable invite token for the given group.
 */

import type { GroupId } from '@domain/types';
import { groupRepository } from '@repositories';
import { useMutation } from '@tanstack/react-query';

export function useCreateGroupInvite() {
  return useMutation({
    mutationFn: (groupId: GroupId) => groupRepository.createGroupInvite(groupId),
  });
}
