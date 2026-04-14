/**
 * domain/groupImage.ts
 *
 * Pure helpers for parsing and working with group image values.
 *
 * The `imageUrl` field on a Group encodes three states:
 *   - undefined / null     → show the default icon
 *   - 'icon:<key>'         → show a predefined icon identified by <key>
 *   - any other string     → treat as an uploaded image URL
 *
 * All logic here is pure and dependency-free (domain layer invariant).
 */

/** Predefined icon keys that the app supports. */
export const PREDEFINED_ICON_KEYS = ['default', 'camping', 'plane', 'vacation'] as const;
export type PredefinedIconKey = (typeof PREDEFINED_ICON_KEYS)[number];

export type GroupImage =
  | { type: 'icon'; key: PredefinedIconKey | string }
  | { type: 'url'; url: string };

/**
 * Parses a raw imageUrl string into a typed GroupImage discriminated union.
 * Safe to call with undefined — returns the default icon in that case.
 */
export function parseGroupImage(imageUrl?: string | null): GroupImage {
  if (!imageUrl) return { type: 'icon', key: 'default' };
  if (imageUrl.startsWith('icon:')) return { type: 'icon', key: imageUrl.slice(5) };
  return { type: 'url', url: imageUrl };
}

/**
 * Builds the imageUrl string for a predefined icon choice.
 * e.g. buildIconImageUrl('camping') → 'icon:camping'
 */
export function buildIconImageUrl(key: string): string {
  return `icon:${key}`;
}
