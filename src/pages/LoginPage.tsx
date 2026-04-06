/**
 * pages/LoginPage.tsx
 *
 * Route: /login
 *
 * Full-bleed login screen with branding (mascot + wordmark + tagline)
 * and three auth methods: Google OAuth, magic link, email/password.
 * Guarded by GuestGuard: redirects to /home if already authenticated.
 */

import { SharliMascot } from '@components/shared/EmptyState';
import { EnvBadge } from '@components/shared/EnvBadge';
import { useTranslation } from 'react-i18next';
import LoginForm from '../features/auth/components/LoginForm';

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      {/* Branding area */}
      <div className="flex flex-col items-center gap-3">
        <SharliMascot size="lg" />
        <h1 className="text-3xl font-bold text-foreground">Sharli</h1>
        <p className="max-w-xs text-center text-sm text-muted-foreground">{t('auth.tagline')}</p>
      </div>

      {/* Auth area — card surface elevates the form from the background */}
      <div className="mt-8 w-full max-w-sm rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
        <LoginForm />
      </div>

      <EnvBadge />
    </div>
  );
}
