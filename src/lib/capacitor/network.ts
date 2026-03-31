/**
 * lib/capacitor/network.ts
 *
 * Wrapper around the @capacitor/network plugin.
 *
 * All Capacitor plugin calls are wrapped here — never import Capacitor
 * plugins directly inside features/ or components/. This wrapper:
 *   - Provides a consistent API regardless of platform (web vs native)
 *   - Makes the code testable (swap this module in tests)
 *   - Isolates the native layer from business logic
 *
 * On web (desktop browser during development), the Network plugin
 * falls back to the browser's navigator.onLine API.
 *
 * Imported by: lib/storage/syncService.ts
 */

import { Network } from '@capacitor/network';

export const getNetworkStatus = () => Network.getStatus();

export const addNetworkListener = (
  callback: (connected: boolean) => void,
): Promise<{ remove: () => Promise<void> }> => {
  return Network.addListener('networkStatusChange', ({ connected }) => {
    callback(connected);
  });
};
