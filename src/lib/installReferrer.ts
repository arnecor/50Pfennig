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
 *
 * Return format: a prefixed token string passed to parseInviteToken():
 *   'f:{TOKEN}'  — friend invite (e.g. 'f:AB12CD')
 *   'g:{TOKEN}'  — group invite  (e.g. 'g:G4RK2P')
 *   null         — no referrer or already consumed
 *
 * Play Store referrer param format: `invite_token=f:TOKEN` or `invite_token=g:TOKEN`.
 *
 * iOS: returns null (no native equivalent). A Swift implementation can be added
 * later via server-side fingerprint matching when iOS support is built out.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

interface InstallReferrerPlugin {
  getReferrer(): Promise<{ referrer?: string }>;
}

const InstallReferrer = registerPlugin<InstallReferrerPlugin>('InstallReferrer');

const CHECKED_KEY = 'install_referrer_checked';

export async function checkInstallReferrer(): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return null;
  }
  if (localStorage.getItem(CHECKED_KEY)) {
    return null;
  }
  localStorage.setItem(CHECKED_KEY, '1');
  try {
    const { referrer } = await InstallReferrer.getReferrer();
    if (!referrer) return null;
    const params = new URLSearchParams(referrer);
    return params.get('invite_token');
  } catch {
    return null;
  }
}
