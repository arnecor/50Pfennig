/**
 * features/friends/utils/getInviteUrl.ts
 *
 * Builds the shareable invite URL for a friend invite token.
 * Format: https://invite.sharli.app/f/{token}
 *
 * The /f/ prefix distinguishes friend invites from group invites (/g/).
 */
export function getInviteUrl(token: string): string {
  return `https://invite.sharli.app/f/${token}`;
}
