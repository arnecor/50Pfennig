/**
 * lib/connectivity/connectivityStore.ts
 *
 * Tracks the device's current connection state.
 *
 * Three states (see Offline Mode concept, section "Detecting the offline state"):
 *   - 'online'         : OS reports connected AND Supabase is reachable
 *   - 'hard_offline'   : OS reports disconnected (airplane mode, Wi-Fi off, no SIM)
 *   - 'soft_offline'   : OS reports connected but packets don't get through
 *                        (train tunnel, dead zone, hanging router)
 *
 * Feeds:
 *   - connectivityService updates osConnected on @capacitor/network events
 *   - The reachability probe updates the probe result on a periodic HEAD request
 *
 * Store is intentionally ephemeral (not persisted) — the current connection
 * state cannot be stale from a previous session.
 *
 * See: src/lib/connectivity/connectivityService.ts, src/lib/connectivity/probe.ts
 */

import { create } from 'zustand';

export type ConnectionStatus = 'online' | 'hard_offline' | 'soft_offline';

type ConnectivityState = {
  status: ConnectionStatus;
  osConnected: boolean;
  lastProbeAt: number | null;
  lastProbeSucceeded: boolean | null;
  setOsConnected: (connected: boolean) => void;
  setProbeResult: (reachable: boolean) => void;
};

// Derive initial state synchronously from navigator.onLine so writes during the
// async Capacitor probe window are correctly queued on hard-offline boot.
// The probe refines this to 'soft_offline' / 'online' once it completes.
const initialOnline = typeof navigator === 'undefined' || navigator.onLine;

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  status: initialOnline ? 'online' : 'hard_offline',
  osConnected: initialOnline,
  lastProbeAt: null,
  lastProbeSucceeded: null,
  setOsConnected: (connected) =>
    set((state) => {
      if (!connected) {
        return { osConnected: false, status: 'hard_offline' };
      }
      // OS flipped from disconnected to connected: mark as soft_offline until
      // the next probe confirms real reachability. Prevents a premature "Online"
      // flash while the cellular link is still handshaking.
      if (state.status === 'hard_offline') {
        return { osConnected: true, status: 'soft_offline' };
      }
      return { osConnected: true };
    }),
  setProbeResult: (reachable) =>
    set((state) => {
      // If the OS says we're offline, the probe result is stale — ignore it.
      if (!state.osConnected) {
        return { lastProbeAt: Date.now(), lastProbeSucceeded: reachable };
      }
      return {
        status: reachable ? 'online' : 'soft_offline',
        lastProbeAt: Date.now(),
        lastProbeSucceeded: reachable,
      };
    }),
}));

export const isOfflineStatus = (status: ConnectionStatus): boolean => status !== 'online';
