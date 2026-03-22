/**
 * pages/CheckEmailPage.tsx
 *
 * Shown after magic link send or sign-up — tells the user to check their inbox.
 * Differentiates messaging based on `type` search param:
 *   - 'magic_link': "We sent a sign-in link…"
 *   - 'signup' (or missing): "We sent a confirmation link…" (original behavior)
 *
 * Route: /auth/check-email?email=...&type=magic_link|signup
 * Guard: none (accessible without a session)
 */

import { Link, useSearch } from '@tanstack/react-router';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CheckEmailPage() {
  const { t } = useTranslation();
  const { email, type } = useSearch({ strict: false }) as {
    email?: string;
    type?: 'magic_link' | 'signup';
  };

  const isMagicLink = type === 'magic_link';

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 gap-6 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
        <Mail className="w-8 h-8 text-primary" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {t(isMagicLink ? 'auth.check_email_magic_link_title' : 'auth.check_email_title')}
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          {t(isMagicLink ? 'auth.check_email_magic_link_message' : 'auth.check_email_message', {
            email: email ?? '',
          })}
        </p>
      </div>

      <Link to="/login" className="text-sm text-primary underline-offset-4 hover:underline">
        {t('auth.check_email_back')}
      </Link>
    </div>
  );
}
