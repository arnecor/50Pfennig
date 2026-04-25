/**
 * store/connectivityStore.ts
 *
 * Re-exports the connectivity store from lib/connectivity/.
 *
 * The actual store lives in lib/ because it is part of the infrastructure
 * layer (wraps @capacitor/network and the reachability probe). This
 * re-export puts it alongside the other stores for discoverability.
 *
 * Prefer importing the hook `useConnectionStatus` for UI code —
 * it exposes derived booleans.
 */

export { useConnectivityStore } from '@lib/connectivity/connectivityStore';
export { useConnectionStatus } from '@lib/connectivity/useConnectionStatus';
export type { ConnectionStatus } from '@lib/connectivity/connectivityStore';
export type { ConnectionSnapshot } from '@lib/connectivity/useConnectionStatus';
