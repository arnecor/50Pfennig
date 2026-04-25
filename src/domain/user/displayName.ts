/**
 * domain/user/displayName.ts
 *
 * Pure helpers for resolving the display label of a user across the app.
 * Domain layer is framework-free per CLAUDE.md, so the i18n translator is
 * passed in rather than imported.
 *
 * A profile is considered "deleted" when its account has been hard-deleted
 * via the delete-account flow — the profiles row is preserved as a tombstone
 * so historical expenses, splits and settlements still resolve, but the
 * personal display name and avatar are scrubbed.
 */

export type ProfileDisplayInfo = {
  readonly displayName: string;
  readonly isDeleted: boolean;
};

/** A minimal i18n translator signature compatible with i18next's `t`. */
export type Translator = (key: string) => string;

/**
 * Returns the user-facing label for a profile, falling back to the localised
 * "deleted user" placeholder when the profile is a tombstone or has no name.
 */
export function resolveDisplayName(profile: ProfileDisplayInfo, t: Translator): string {
  if (profile.isDeleted || profile.displayName.trim().length === 0) {
    return t('common.deleted_user');
  }
  return profile.displayName;
}
