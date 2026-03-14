/**
 * lib/installReferrer.ts
 *
 * Checks the Play Store install referrer for an invite token.
 * Used for deferred deep links: when a user installs the app via an
 * invite link, the invite token is embedded in the Play Store referrer
 * param and read here after first launch.
 *
 * Only runs on native Android. Guarded against running multiple times
 * via a localStorage flag.
 */

// TODO: @dudod/capacitor-plugin-install-referrer removed (incompatible with Capacitor 6).
// Restore when a compatible version is available.

/**
 * Stub — always returns null until the install referrer plugin is restored.
 */
export async function checkInstallReferrer(): Promise<string | null> {
  return null;
}
