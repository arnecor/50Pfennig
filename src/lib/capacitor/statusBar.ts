/**
 * lib/capacitor/statusBar.ts
 *
 * Controls Android status bar icon colour (dark or light).
 *
 * The background colour is handled purely by the native Android theme:
 *   - values/styles.xml           → @color/statusBarBackground (light)
 *   - values-night/styles.xml     → @color/statusBarBackground (dark)
 * We deliberately do NOT call setBackgroundColor() from JS because on some
 * Android OEMs (Samsung One UI, etc.) it resets the LIGHT_STATUS_BAR flag,
 * causing the icons to revert to white even after setStyle() was called.
 *
 * Dark-mode detection observes the `.dark` class on <html> rather than the
 * OS-level `prefers-color-scheme` media query, because the app uses
 * class-based dark mode (Tailwind `@custom-variant dark`).
 *
 * This module is the only place that imports @capacitor/status-bar.
 * It is called from App.tsx on startup, before auth hydration.
 * No-op on web (desktop dev).
 */

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

async function apply(dark: boolean): Promise<void> {
  // Style.Dark  = sets SYSTEM_UI_FLAG_LIGHT_STATUS_BAR → dark (black) icons
  // Style.Light = clears the flag                      → light (white) icons
  await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
}

/**
 * Initialises the status bar icon style to match the app's active theme and
 * registers a MutationObserver that updates it whenever the `.dark` class
 * is toggled on <html>.
 */
export async function initStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const isDark = () => document.documentElement.classList.contains('dark');

  await apply(isDark());

  // Re-apply whenever the theme class changes (e.g. user toggles dark mode)
  const observer = new MutationObserver(() => { void apply(isDark()); });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}
