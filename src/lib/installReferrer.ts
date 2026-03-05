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

import { Capacitor } from '@capacitor/core';

const REFERRER_CHECKED_KEY = '50pfennig_referrer_checked';

/**
 * Attempts to extract an invite token from the Play Store install referrer.
 * Returns the token string if found, or null otherwise.
 * Only runs once per installation (idempotent via localStorage flag).
 */
export async function checkInstallReferrer(): Promise<string | null> {
  // Only run on native Android
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return null;
  }

  // Only check once per installation
  if (localStorage.getItem(REFERRER_CHECKED_KEY)) {
    return null;
  }

  try {
    const { InstallReferrer } = await import(
      '@dudod/capacitor-plugin-install-referrer'
    );

    const result = await InstallReferrer.getReferrerDetails();
    localStorage.setItem(REFERRER_CHECKED_KEY, '1');

    if (!result?.referrerUrl) return null;

    // Parse referrer string: "invite_token=abc123&utm_source=..."
    const params = new URLSearchParams(result.referrerUrl);
    return params.get('invite_token') ?? null;
  } catch {
    // Plugin not available or failed — mark as checked to avoid retrying
    localStorage.setItem(REFERRER_CHECKED_KEY, '1');
    return null;
  }
}
