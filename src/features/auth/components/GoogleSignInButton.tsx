/**
 * features/auth/components/GoogleSignInButton.tsx
 *
 * Google OAuth sign-in button following Google's official branding guidelines:
 * white background, multicolor "G" logo, dark gray text.
 * Always white — even in dark mode — per Google trademark requirements.
 *
 * Modes:
 *   - "signin" (default): creates/signs in to a Google-based account
 *   - "link":             attaches a Google identity to the current session,
 *                         used by the guest-upgrade flow on AccountPage
 */

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

/** Multicolor Google "G" logo — inline SVG to avoid external asset dependency. */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export type GoogleSignInButtonMode = 'signin' | 'link';

interface GoogleSignInButtonProps {
  mode?: GoogleSignInButtonMode;
}

export default function GoogleSignInButton({ mode = 'signin' }: GoogleSignInButtonProps = {}) {
  const { t } = useTranslation();
  const { signInWithGoogle, linkGoogleIdentity } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'link') {
        await linkGoogleIdentity();
      } else {
        await signInWithGoogle();
      }
    } catch {
      setError(t('auth.error_google_sign_in'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        aria-label={t('auth.continue_with_google')}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-white dark:text-gray-700 dark:hover:bg-gray-50"
      >
        <GoogleLogo className="h-5 w-5 shrink-0" />
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.continue_with_google')}
      </button>
      {error && <p className="mt-1.5 text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
