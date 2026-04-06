/**
 * features/invites/lib/parseInviteToken.ts
 *
 * Central parser for both deep-link URLs and Play Store referrer values.
 * Returns a typed invite descriptor so callers never need to inspect the raw string.
 *
 * Supported inputs:
 *   com.arco.sharli://invite/f/AB12CD   → { type: 'friend', token: 'AB12CD' }
 *   com.arco.sharli://invite/g/G4RK2P   → { type: 'group',  token: 'G4RK2P' }
 *   f:AB12CD  (Play Store referrer)     → { type: 'friend', token: 'AB12CD' }
 *   g:G4RK2P  (Play Store referrer)     → { type: 'group',  token: 'G4RK2P' }
 */

export type ParsedInvite = { type: 'friend'; token: string } | { type: 'group'; token: string };

const TOKEN_RE = /^[A-Z0-9]{6}$/;

/**
 * Parses a deep-link URL or a Play Store referrer token string.
 * Returns null when the input does not match any known invite format.
 */
export function parseInviteToken(input: string): ParsedInvite | null {
  if (!input) return null;

  // Deep-link URL: com.arco.sharli://invite/{type}/{token}
  try {
    const url = new URL(input);
    const friendMatch = url.pathname.match(/\/f\/([A-Z0-9]{6})$/);
    if (friendMatch?.[1]) return { type: 'friend', token: friendMatch[1] };

    const groupMatch = url.pathname.match(/\/g\/([A-Z0-9]{6})$/);
    if (groupMatch?.[1]) return { type: 'group', token: groupMatch[1] };
  } catch {
    // Not a URL — fall through to referrer parsing
  }

  // Play Store referrer token: 'f:TOKEN' or 'g:TOKEN'
  if (input.startsWith('f:')) {
    const token = input.slice(2);
    if (TOKEN_RE.test(token)) return { type: 'friend', token };
  }

  if (input.startsWith('g:')) {
    const token = input.slice(2);
    if (TOKEN_RE.test(token)) return { type: 'group', token };
  }

  return null;
}
