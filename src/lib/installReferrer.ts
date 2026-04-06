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
 */

// TODO: @dudod/capacitor-plugin-install-referrer removed (incompatible with Capacitor 6).
// Restore when a compatible version is available.
// When restored, parse the `invite_token` query param from the referrer string,
// return its value ('f:TOKEN' or 'g:TOKEN') directly — App.tsx passes it to
// dispatchInviteToken() which calls parseInviteToken() internally.

/**
 * Stub — always returns null until the install referrer plugin is restored.
 */
export async function checkInstallReferrer(): Promise<string | null> {
  return null;
}
