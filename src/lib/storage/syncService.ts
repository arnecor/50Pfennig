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
 *
 * This service is the pull-based fallback layer. The push-based layer
 * (Supabase Realtime) handles real-time updates during active sessions.
 * Together they guarantee freshness in all scenarios.
 *
 * Future: when the offline mutation queue (offlineQueue.ts) is implemented,
 * the flush logic should also be called here on reconnect.
 *
 * Called from: src/App.tsx (initSyncService after sign-in, cleanup on sign-out)
 * Performance notes: docs/realtime-sync.md
 */

import { App } from '@capacitor/app';
import { addNetworkListener } from '@lib/capacitor/network';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Starts listening for app-resume and network-reconnect events.
 * Returns a cleanup function — call it on sign-out or unmount.
 */
export async function initSyncService(queryClient: QueryClient): Promise<() => void> {
  const invalidateAll = () => {
    queryClient.invalidateQueries();
  };

  const appHandle = await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) invalidateAll();
  });

  const netHandle = await addNetworkListener((connected) => {
    if (connected) invalidateAll();
  });

  return () => {
    void appHandle.remove();
    void netHandle.remove();
  };
}
