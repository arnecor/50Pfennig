/**
 * features/invites/utils/getInviteUrl.ts
 *
 * Builds a shareable invite URL for friend or group invite tokens.
 *
 *   friend  → https://invite.sharli.app/f/{token}
 *   group   → https://invite.sharli.app/g/{token}
 */

export function getInviteUrl(type: 'friend' | 'group', token: string): string {
  const prefix = type === 'group' ? 'g' : 'f';
  return `https://invite.sharli.app/${prefix}/${token}`;
}
