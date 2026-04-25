/**
 * store/offlineStore.ts
 *
 * Re-exports the offline mutation queue from lib/storage/offlineQueue.ts.
 *
 * The actual store lives in lib/ because it is part of the infrastructure
 * layer. This re-export puts it alongside the other stores for
 * discoverability when working on features.
 *
 * See lib/storage/offlineQueue.ts for the full implementation.
 * See ADR-0004 for the offline-first strategy.
 */

export {
  MAX_RETRIES,
  clearOfflineQueue,
  isPermanentlyFailed,
  useOfflineQueue,
} from '@lib/storage/offlineQueue';
export type {
  ErrorKind,
  MutationType,
  QueuedMutation,
} from '@lib/storage/offlineQueue';
