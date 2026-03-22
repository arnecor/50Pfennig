/**
 * features/auth/components/LoginForm.tsx
 *
 * Composition component for the login/registration screen.
 * Full-bleed layout (no Card wrapper) with three auth methods:
 *   1. Google OAuth (most prominent)
 *   2. Magic link (default email method — passwordless)
 *   3. Email + password (progressive disclosure, toggled by user)
 *
 * Email value is preserved when switching between magic link and password modes.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import EmailPasswordForm from './EmailPasswordForm';
import GoogleSignInButton from './GoogleSignInButton';
import MagicLinkForm from './MagicLinkForm';

const GOOGLE_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true';

export default function LoginForm() {
  const { t } = useTranslation();
  const [authMethod, setAuthMethod] = useState<'magic_link' | 'password'>('magic_link');
  const [email, setEmail] = useState('');

  return (
    <div className="w-full max-w-sm space-y-0">
      {GOOGLE_LOGIN_ENABLED && (
        <>
          {/* Google OAuth — highest-conversion option */}
          <GoogleSignInButton />

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('auth.or_divider')}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {/* Email auth — magic link (default) or password (toggled) */}
      {authMethod === 'magic_link' ? (
        <MagicLinkForm
          defaultEmail={email}
          onSwitchToPassword={(currentEmail) => {
            setEmail(currentEmail);
            setAuthMethod('password');
          }}
        />
      ) : (
        <EmailPasswordForm
          defaultEmail={email}
          onSwitchToMagicLink={(currentEmail) => {
            setEmail(currentEmail);
            setAuthMethod('magic_link');
          }}
        />
      )}
    </div>
  );
}
