/**
 * lib/featureFlags.ts
 *
 * Minimal feature-flag surface. v1 reads from localStorage with a safe
 * default; a remote flag (Supabase table + fetch on session start) can be
 * swapped in behind the same API without touching callers.
 *
 * Tech-debt note: remote control is not yet implemented. For now the flag
 * is only togglable per-device via localStorage (DevTools console or the
 * Settings screen once we add a debug toggle). Tracked as Phase 2 work on
 * the Offline Mode concept.
 *
 * Usage:
 *   if (!isOfflineModeEnabled()) return null;
 */

const FLAG_KEYS = {
  OFFLINE_MODE: 'sharli.flag.offline_mode',
} as const;

function readBoolFlag(key: string, defaultValue: boolean): boolean {
  if (typeof localStorage === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === 'true';
  } catch {
    return defaultValue;
  }
}

export function isOfflineModeEnabled(): boolean {
  return readBoolFlag(FLAG_KEYS.OFFLINE_MODE, true);
}

export const FEATURE_FLAG_KEYS = FLAG_KEYS;
