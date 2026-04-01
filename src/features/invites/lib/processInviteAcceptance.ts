/**
 * features/invites/lib/processInviteAcceptance.ts
 *
 * Plain async functions that accept an invite token and perform all
 * side-effects (repository call, cache invalidation, navigation).
 *
 * These functions are intentionally NOT hooks — they are called imperatively
 * from App.tsx (deep link handler, pending-token check after login) where
 * React hook rules do not apply.
 *
 * Errors are swallowed and navigation still happens — an expired or already-used
 * token is a non-fatal condition; the user lands on the relevant page and sees
 * the current state.
 */

import type { GroupId } from '@domain/types';
import { friendRepository, groupRepository } from '@repositories';
import type { QueryClient } from '@tanstack/react-query';
import { router } from '../../../router';

export async function processFriendInviteToken(
  token: string,
  queryClient: QueryClient,
): Promise<void> {
  try {
    await friendRepository.acceptInvite(token);
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    router.navigate({ to: '/friends' });
  } catch {
    // Token expired, already used, or already friends — navigate anyway
    router.navigate({ to: '/friends' });
  }
}

export async function processGroupInviteToken(
  token: string,
  queryClient: QueryClient,
): Promise<void> {
  try {
    const groupId = await groupRepository.acceptGroupInvite(token);
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    router.navigate({ to: '/groups/$groupId', params: { groupId: groupId as GroupId } });
  } catch {
    // Token expired, revoked, or already a member — navigate to groups list
    router.navigate({ to: '/groups' });
  }
}
