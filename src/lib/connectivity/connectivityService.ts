/**
 * lib/connectivity/connectivityService.ts
 *
 * Initialises the connectivity detection. Does three things:
 *
 *   1. Reads the initial OS network state (@capacitor/network) and seeds the store.
 *   2. Subscribes to OS network changes and updates the store.
 *   3. Periodically probes Supabase reachability while OS reports connected,
 *      to catch "soft offline" scenarios (train tunnels, dead cells).
 *
 * See Offline Mode concept, section "Detecting the offline state".
 *
 * Called from: src/App.tsx (alongside initSyncService, cleanup on sign-out).
 */

import { addNetworkListener, getNetworkStatus } from '@lib/capacitor/network';
import { useConnectivityStore } from './connectivityStore';
import { probeSupabaseReachability } from './probe';

const PROBE_INTERVAL_MS = 30_000; // 30 s while online — cheap HEAD, keeps banner honest

/**
 * Starts the connectivity service. Returns a cleanup function.
 */
export async function initConnectivityService(): Promise<() => void> {
  const runProbe = async () => {
    const reachable = await probeSupabaseReachability();
    useConnectivityStore.getState().setProbeResult(reachable);
  };

  // 1. Seed initial OS state.
  try {
    const initial = await getNetworkStatus();
    useConnectivityStore.getState().setOsConnected(initial.connected);
  } catch {
    // Network plugin unavailable — fall back to navigator.onLine.
    useConnectivityStore
      .getState()
      .setOsConnected(typeof navigator !== 'undefined' ? navigator.onLine : true);
  }

  // 2. First probe to confirm reachability on startup.
  void runProbe();

  // 3. Listen for OS changes. On reconnect, probe immediately.
  const listener = await addNetworkListener((connected) => {
    useConnectivityStore.getState().setOsConnected(connected);
    if (connected) void runProbe();
  });

  // 4. Periodic probe while supposedly online.
  const intervalId = setInterval(() => {
    if (useConnectivityStore.getState().osConnected) void runProbe();
  }, PROBE_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
    void listener.remove();
  };
}
