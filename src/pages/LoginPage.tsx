/**
 * pages/LoginPage.tsx
 *
 * Route: /login
 *
 * Thin wrapper — renders the LoginForm feature component.
 * Guarded by GuestGuard: redirects to /groups if already authenticated.
 */

import { EnvBadge } from '@components/shared/EnvBadge';
import { SharliMascot } from '@components/shared/EmptyState';
import LoginForm from '../features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background gap-6">
      <div className="flex flex-col items-center gap-3">
        <SharliMascot size="lg" />
        <h1 className="text-3xl font-bold text-foreground">Sharli</h1>
      </div>
      <LoginForm />
      <EnvBadge />
    </div>
  );
}
