/**
 * lib/storage/syncService.ts
 *
 * The offline sync service. Started once at app boot.
 *
 * Responsibilities:
 *   1. Listen for connectivity change events (@capacitor/network)
 *   2. Listen for app-foreground events (@capacitor/app)
 *   3. On either event (if connected): flush the offlineMutationQueue
 *
 * Flush behaviour:
 *   - Process mutations in insertion order (FIFO)
 *   - Each mutation is dispatched to the appropriate repository method
 *   - On success: dequeue the mutation
 *   - On failure: increment retry counter, STOP processing (preserves order)
 *   - After MAX_RETRIES failures: surface conflict to the user via uiStore
 *   - After a successful flush: invalidate affected TanStack Query keys
 *
 * Called from: src/App.tsx (startSyncService on mount)
 * Imports from: lib/storage/offlineQueue, repositories/index, store/uiStore
 */

// TODO: Implement after Capacitor plugins and repositories are set up.
//
// import { Network } from '@capacitor/network';
// import { App } from '@capacitor/app';
//
// export const startSyncService = (queryClient: QueryClient) => {
//   const flush = async () => { ... };
//   Network.addListener('networkStatusChange', ({ connected }) => {
//     if (connected) flush();
//   });
//   App.addListener('appStateChange', ({ isActive }) => {
//     if (isActive) flush();
//   });
// };

export {};
