/**
 * lib/storage/offlineQueue.ts
 *
 * The offline mutation queue — a Zustand store persisted to IndexedDB.
 *
 * When a write operation (create expense, create group, etc.) is attempted
 * while the device is offline, the mutation is enqueued here instead of
 * being sent to Supabase immediately.
 *
 * The syncService (lib/storage/syncService.ts) listens for connectivity
 * events and flushes this queue in insertion order when the device comes
 * back online.
 *
 * Queue ordering is critical: mutations must be replayed in order to
 * preserve causal consistency (e.g. an expense created in a group that
 * was also created offline must replay *after* the group). If any
 * mutation fails transiently, the flush stops for that item; FIFO order
 * means later items wait their turn. Retries are capped at MAX_RETRIES;
 * after that, the mutation is surfaced to the user as a conflict
 * requiring manual resolution (Pending Changes screen — Phase 2).
 *
 * See ADR-0004 for the full offline-first strategy.
 * See the Offline Mode concept (plans/...-serialized-hopper.md) for the
 * Phase 1/2 split — this file is the Phase 1 skeleton; repository wrapping
 * and the flush function land in Phase 2.
 *
 * Imported by (future): repositories/supabase/* (enqueue), syncService (flush)
 */

import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const MAX_RETRIES = 5;

export type MutationType = 'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'DELETE_EXPENSE' | 'CREATE_GROUP';

export type ErrorKind = 'retryable' | 'permanent';

export type QueuedMutation = {
  /** Client-generated UUID. For CREATE_* this is the temp entity id. */
  id: string;
  type: MutationType;
  /** RPC parameters. Shape is per-mutation; validated at replay time. */
  payload: Record<string, unknown>;
  /** ms epoch — used for FIFO ordering and display in Pending Changes. */
  createdAt: number;
  retryCount: number;
  lastError?: string;
  errorKind?: ErrorKind;
};

type QueueState = {
  items: QueuedMutation[];
  /**
   * Appends a mutation to the queue. Sets retryCount to 0 and stamps
   * createdAt. Callers must supply their own id (temp UUID) so they can
   * reference the pending entity in optimistic cache updates.
   */
  enqueue: (mutation: Omit<QueuedMutation, 'retryCount' | 'createdAt'>) => void;
  /** Removes a mutation from the queue (successful replay). */
  complete: (id: string) => void;
  /**
   * Records a failed replay attempt. Increments retryCount. If errorKind
   * is 'permanent', the mutation is frozen in-place and will not auto-retry.
   */
  recordFailure: (id: string, error: string, kind: ErrorKind) => void;
  /** Resets a mutation's retry counter (used by Pending Changes → Retry). */
  resetRetries: (id: string) => void;
  /** Wipes the queue. Called on sign-out. */
  removeAll: () => void;
};

const QUEUE_STORAGE_KEY = 'sharli-offline-queue';

/** Zustand's persist middleware expects a string-based storage adapter. */
const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const value = await idbGet<string>(key);
    return value ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await idbSet(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await idbDel(key);
  },
};

export const useOfflineQueue = create<QueueState>()(
  persist(
    (set) => ({
      items: [],
      enqueue: (mutation) =>
        set((state) => ({
          items: [...state.items, { ...mutation, retryCount: 0, createdAt: Date.now() }],
        })),
      complete: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      recordFailure: (id, error, kind) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  retryCount: item.retryCount + 1,
                  lastError: error,
                  errorKind: kind,
                }
              : item,
          ),
        })),
      resetRetries: (id) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            // Strip optional error fields rather than setting to undefined —
            // `exactOptionalPropertyTypes: true` forbids `undefined` in optionals.
            const { lastError: _lastError, errorKind: _errorKind, ...rest } = item;
            return { ...rest, retryCount: 0 };
          }),
        })),
      removeAll: () => set({ items: [] }),
    }),
    {
      name: QUEUE_STORAGE_KEY,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);

/** Queue items whose retries are exhausted or that returned a permanent error. */
export const isPermanentlyFailed = (m: QueuedMutation): boolean =>
  m.errorKind === 'permanent' || m.retryCount >= MAX_RETRIES;

/**
 * Clears the queue both in memory and in IndexedDB. Use on sign-out to
 * prevent cross-account leakage.
 */
export async function clearOfflineQueue(): Promise<void> {
  useOfflineQueue.getState().removeAll();
  await idbDel(QUEUE_STORAGE_KEY);
}
