/**
 * lib/storage/syncService.ts
 *
 * Pull-based sync service. Started once after the user signs in.
 *
 * Responsibilities:
 *   1. Listen for app-foreground events (@capacitor/app) — invalidate all
 *      active queries when the app returns to the foreground. This ensures
 *      data is fresh after the user switches away and comes back.
 *   2. Listen for network-reconnect events (@capacitor/network) — invalidate
 *      all active queries when connectivity is restored. This handles the case
 *      where the device was offline and missed Realtime events.
 *   3. Subscribe to the connectivity store so soft-offline recoveries
 *      (probe-confirmed) also kick off a queue flush, and drain the offline
 *      mutation queue (flushOfflineQueue) whenever we transition online.
 *
 * This service is the pull-based fallback layer. The push-based layer
 * (Supabase Realtime) handles real-time updates during active sessions.
 * Together they guarantee freshness in all scenarios.
 *
 * Called from: src/App.tsx (initSyncService after sign-in, cleanup on sign-out)
 * Performance notes: docs/realtime-sync.md
 */

import { App } from '@capacitor/app';
import { addNetworkListener } from '@lib/capacitor/network';
import { useConnectivityStore } from '@lib/connectivity/connectivityStore';
import type { QueryClient } from '@tanstack/react-query';

import { flushOfflineQueue } from './flushOfflineQueue';

/**
 * Starts listening for app-resume and network-reconnect events.
 * Returns a cleanup function — call it on sign-out or unmount.
 *
 * On reconnect (OS-level) we invalidate all queries AND trigger a queue
 * flush. We subscribe to the connectivity store too so soft-offline
 * recoveries (probe-confirmed) also kick off a flush — the OS-level
 * listener misses those because the OS still reported connected throughout.
 */
export async function initSyncService(queryClient: QueryClient): Promise<() => void> {
  const invalidateAll = () => {
    queryClient.invalidateQueries();
  };

  const triggerFlush = () => {
    void flushOfflineQueue(queryClient);
  };

  const appHandle = await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      invalidateAll();
      // App-resume is a second chance to drain the queue — the user may
      // have been offline while the app was backgrounded and we missed
      // the reconnect event.
      if (useConnectivityStore.getState().status === 'online') triggerFlush();
    }
  });

  const netHandle = await addNetworkListener((connected) => {
    if (connected) {
      invalidateAll();
      // Defer slightly so the probe has a chance to confirm reachability
      // before we fire potentially many RPCs at a flaky link.
      setTimeout(triggerFlush, 500);
    }
  });

  // Soft-offline recovery: OS stayed connected, but our reachability probe
  // flipped from false → true. Treat as a reconnect for queue purposes.
  let previousStatus = useConnectivityStore.getState().status;
  const unsubscribeStore = useConnectivityStore.subscribe((state) => {
    if (previousStatus !== 'online' && state.status === 'online') {
      triggerFlush();
    }
    previousStatus = state.status;
  });

  // Initial flush attempt on startup in case the queue already has items
  // from a previous session and we launched online.
  if (useConnectivityStore.getState().status === 'online') triggerFlush();

  return () => {
    void appHandle.remove();
    void netHandle.remove();
    unsubscribeStore();
  };
}
