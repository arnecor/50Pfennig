/**
 * lib/capacitor/backHandler.ts
 *
 * Android hardware back button handler for Capacitor.
 *
 * Provides a lightweight LIFO priority stack so that multiple components
 * can register handlers without coordinating with each other. The topmost
 * registered handler that returns `true` consumes the event; if none does,
 * `window.history.back()` is called as the final fallback.
 *
 * Usage:
 *   - Call `initBackHandler()` once from App.tsx inside the Capacitor
 *     useEffect that already registers other listeners.
 *   - Call `useBackHandler(fn)` inside any component that needs to intercept
 *     the back button (overlays, root tab pages, guest screens).
 *
 * No-op on web — guarded by Capacitor.isNativePlatform() inside initBackHandler.
 * This module is the only place that registers a 'backButton' listener.
 */

import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Internal priority stack — module-level so it survives component re-renders.
// ---------------------------------------------------------------------------

type HandlerEntry = { fn: () => boolean };

const stack: HandlerEntry[] = [];

/**
 * Pushes a handler onto the stack. Returns a cleanup function that removes it.
 * The handler should return `true` to consume the event, `false` to pass through.
 *
 * @internal — prefer `useBackHandler` in React components.
 */
export function pushBackHandler(fn: () => boolean): () => void {
  const entry: HandlerEntry = { fn };
  stack.push(entry);
  return () => {
    const idx = stack.indexOf(entry);
    if (idx !== -1) stack.splice(idx, 1);
  };
}

/**
 * Iterates the stack in LIFO order until one handler returns `true`.
 * Falls back to `window.history.back()` if no handler consumes the event.
 */
function dispatchBack(): void {
  for (let i = stack.length - 1; i >= 0; i--) {
    // biome-ignore lint/style/noNonNullAssertion: loop bound guarantees i is in range
    if (stack[i]!.fn()) return;
  }
  window.history.back();
}

/**
 * Registers the Capacitor 'backButton' listener. Call once from App.tsx.
 * Cleanup is handled by the existing `CapacitorApp.removeAllListeners()` call
 * in App.tsx — no separate teardown needed here.
 */
export function initBackHandler(): void {
  if (!Capacitor.isNativePlatform()) return;
  void CapacitorApp.addListener('backButton', () => dispatchBack());
}

/**
 * React hook. Pushes `fn` onto the back-handler stack for the lifetime of the
 * component. Uses a ref so the latest closure is always invoked — avoids stale
 * capture of props/state.
 *
 * @param fn - return `true` to consume the event, `false` to pass through
 */
export function useBackHandler(fn: () => boolean): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => pushBackHandler(() => fnRef.current()), []);
}
