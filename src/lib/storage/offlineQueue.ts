/**
 * lib/storage/offlineQueue.ts
 *
 * The offline mutation queue — a Zustand store persisted to IndexedDB.
 *
 * When a write operation (create expense, record settlement, etc.) is
 * attempted while the device is offline, the mutation is enqueued here
 * instead of being sent to Supabase immediately.
 *
 * The syncService (lib/storage/syncService.ts) listens for connectivity
 * events and flushes this queue in insertion order when the device comes
 * back online.
 *
 * Queue ordering is critical: mutations must be replayed in order to
 * preserve causal consistency (e.g. you cannot settle an expense that
 * hasn't been synced yet). If any mutation fails, the flush stops.
 * Retries are capped at 5; after that, the mutation is surfaced to the
 * user as a conflict requiring manual resolution.
 *
 * See ADR-0004 for the full offline-first strategy.
 *
 * Imported by: repositories/supabase/* (to enqueue), lib/storage/syncService.ts (to flush)
 */

// TODO: Install zustand, then implement:
//
// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
//
// export type QueuedMutation = {
//   id: string;         // client-generated UUID for deduplication
//   type: 'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'DELETE_EXPENSE'
//       | 'CREATE_SETTLEMENT' | 'DELETE_SETTLEMENT';
//   payload: unknown;
//   createdAt: number;  // Date.now() — used for ordering
//   retryCount: number;
// };
//
// export const MAX_RETRIES = 5;

export {};
