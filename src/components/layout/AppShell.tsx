/**
 * components/layout/AppShell.tsx
 *
 * The root layout component — wraps all authenticated pages.
 *
 * Responsibilities:
 *   - Bottom navigation bar (groups, settings)
 *   - Safe area insets for Android notch / gesture bar
 *     (CSS: env(safe-area-inset-bottom), env(safe-area-inset-top))
 *   - Renders <Outlet /> (TanStack Router) for the active route
 *
 * This is the component attached to the root route in router/index.tsx.
 */

import { Outlet } from '@tanstack/react-router';

export default function AppShell() {
  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
