/**
 * lib/connectivity/useConnectionStatus.ts
 *
 * The consumer-facing hook for connection state. Prefer this over reading
 * the store directly — it exposes the derived booleans UI code cares about.
 */

import { type ConnectionStatus, useConnectivityStore } from './connectivityStore';

export type ConnectionSnapshot = {
  status: ConnectionStatus;
  isOnline: boolean;
  isOffline: boolean;
  isHardOffline: boolean;
  isSoftOffline: boolean;
};

export function useConnectionStatus(): ConnectionSnapshot {
  const status = useConnectivityStore((s) => s.status);
  return {
    status,
    isOnline: status === 'online',
    isOffline: status !== 'online',
    isHardOffline: status === 'hard_offline',
    isSoftOffline: status === 'soft_offline',
  };
}
