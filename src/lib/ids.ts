/**
 * lib/ids.ts
 *
 * Client-side ID generation for offline-first writes.
 *
 * When a user creates an entity (expense, group) while offline, we cannot
 * ask the server for a UUID. Instead we mint a client temp UUID prefixed
 * with `tmp_` so the optimistic cache + offline queue can reference it by
 * a stable value. When the queued mutation is replayed on reconnect, the
 * real server id is learned and the temp id is swapped out of the cache.
 *
 * The `tmp_` prefix is load-bearing:
 *   - flushOfflineQueue uses isTempId() to rewrite parent references
 *     (e.g. an expense queued against a group that was also created offline)
 *   - UI components use isTempId() to suppress deep-linking/sharing for
 *     entities that don't yet exist on the server (see plan — Other §A).
 */

export const TEMP_ID_PREFIX = 'tmp_';

/**
 * Generates a client-side temporary UUID prefixed with `tmp_`.
 * Uses crypto.randomUUID so collision probability matches the server.
 */
export function generateTempId(): string {
  return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}

/** True when the id was minted client-side and has not yet been reconciled. */
export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}
