/**
 * pages/OnboardingPage.tsx
 *
 * Route: /onboarding
 *
 * First-time user entry point. Two-step flow rendered by a single component:
 *
 *   Step 1 — Name
 *     Full Sharli branding (mascot + wordmark + tagline), a single name
 *     input (max 20 chars), and a "Weiter" button. A secondary text link
 *     "Bereits einen Account? Anmelden" gives returning users an immediate
 *     escape hatch to /login.
 *
 *   Step 2 — Account question
 *     Personalised "Hallo, {name}!" headline, the question
 *     "Möchtest du einen (kostenlosen) Account erstellen?", a short value
 *     explainer, and a password-first auth form. A small toggle link swaps
 *     the form between password mode and login-link (magic link) mode so
 *     both paths are available without competing CTAs. "Als Gast starten"
 *     is always visible and always enabled below the "oder" divider. A
 *     Google button is rendered last if VITE_ENABLE_GOOGLE_LOGIN is true.
 *
 * No route change happens between steps — the step is local component state
 * so the typed name survives navigation between the two views.
 *
 * Guarded by requireGuest: if a session already exists, redirect to /home.
 */

import { SharliMascot } from '@/components/shared/EmptyState';
import { EnvBadge } from '@/components/shared/EnvBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GoogleSignInButton from '@/features/auth/components/GoogleSignInButton';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const NAME_MAX_LENGTH = 20;
const PASSWORD_MIN_LENGTH = 6;

type Step = 'name' | 'account';

export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signUp, signInWithMagicLink, signInAsGuest } = useAuth();

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const step1Valid = trimmedName.length > 0;

  const emailTrimmed = email.trim();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
  const passwordValid = password.length >= PASSWORD_MIN_LENGTH;

  const handleContinueFromName = () => {
    if (!step1Valid) return;
    setServerError(null);
    setStep('account');
  };

  const handleBackToName = () => {
    setServerError(null);
    setStep('name');
  };

  const translateAuthError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('already registered')) return t('auth.error_email_taken');
    if (msg.includes('Password should be')) return t('auth.error_weak_password');
    if (msg.includes('rate') || msg.includes('limit')) return t('auth.error_rate_limited');
    return t('common.error_generic');
  };

  const handleCreateAccount = async () => {
    if (!emailLooksValid || !passwordValid) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      await signUp(emailTrimmed, password, trimmedName);
    } catch (err) {
      setServerError(translateAuthError(err));
      setIsSubmitting(false);
    }
  };

  const handleSendLoginLink = async () => {
    if (!emailLooksValid) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      await signInWithMagicLink(emailTrimmed, trimmedName);
    } catch (err) {
      setServerError(`${t('auth.error_magic_link')} ${translateAuthError(err)}`);
      setIsSubmitting(false);
    }
  };

  const handleGuestStart = async () => {
    if (!step1Valid) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      await signInAsGuest(trimmedName);
    } catch {
      setServerError(t('common.error_generic'));
      setIsSubmitting(false);
    }
  };

  const handleGoToLogin = () => {
    void navigate({ to: '/login' });
  };

  // --- Step 1 — Name ------------------------------------------------------
  if (step === 'name') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
        {/* Branding area — mirrors LoginPage exactly */}
        <div className="flex flex-col items-center gap-3">
          <SharliMascot size="lg" />
          <h1 className="text-3xl font-bold text-foreground">Sharli</h1>
          <p className="max-w-xs text-center text-sm text-muted-foreground">{t('auth.tagline')}</p>
        </div>

        {/* Form card */}
        <div className="mt-8 w-full max-w-sm rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleContinueFromName();
            }}
            className="w-full space-y-4"
            noValidate
          >
            <h2 className="text-lg font-semibold text-foreground">
              {t('onboarding.name_headline')}
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="onboarding-name">{t('auth.display_name')}</Label>
              <Input
                id="onboarding-name"
                type="text"
                autoComplete="given-name"
                autoFocus
                maxLength={NAME_MAX_LENGTH}
                placeholder={t('onboarding.name_placeholder')}
                className="h-11 bg-background"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <Button type="submit" className="h-11 w-full" disabled={!step1Valid}>
              {t('common.continue')}
            </Button>

            <button
              type="button"
              onClick={handleGoToLogin}
              className="w-full py-2 text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {t('onboarding.already_have_account')}
            </button>
          </form>
        </div>

        <EnvBadge />
      </div>
    );
  }

  // --- Step 2 — Account question -----------------------------------------
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
        {/* Back arrow */}
        <button
          type="button"
          onClick={handleBackToName}
          className="-ml-2 -mt-2 mb-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Personalised greeting + question */}
        <div className="mb-5 space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            {t('onboarding.greeting', { name: trimmedName })}
          </h2>
          <p className="text-base font-medium text-foreground">
            {t('onboarding.account_question')}
          </p>
          <p className="text-sm text-muted-foreground">{t('onboarding.account_explainer')}</p>
        </div>

        {/* Account creation form — email + password */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreateAccount();
          }}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-email">{t('auth.email')}</Label>
            <Input
              id="onboarding-email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder={t('auth.email_placeholder')}
              className="h-11 bg-background"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="onboarding-password">{t('auth.password')}</Label>
            <Input
              id="onboarding-password"
              type="password"
              autoComplete="new-password"
              placeholder={t('auth.password_placeholder')}
              className="h-11 bg-background"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('auth.password_min_hint')}</p>
          </div>

          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            className="h-11 w-full"
            disabled={!emailLooksValid || !passwordValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.signing_in')}
              </>
            ) : (
              t('onboarding.create_account')
            )}
          </Button>
        </form>

        {/* Guest path — prominent, directly below the account form */}
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 w-full"
          onClick={handleGuestStart}
          disabled={isSubmitting}
        >
          {t('onboarding.start_as_guest')}
        </Button>

        {/* Divider */}
        <div className="my-5 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('auth.or_divider')}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Magic link path */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendLoginLink();
          }}
          className="space-y-3"
          noValidate
        >
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {t('auth.magic_link_hint')}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-email-magic">{t('auth.email')}</Label>
            <Input
              id="onboarding-email-magic"
              type="email"
              autoComplete="email"
              placeholder={t('auth.email_placeholder')}
              className="h-11 bg-background"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-11 w-full"
            disabled={!emailLooksValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.signing_in')}
              </>
            ) : (
              t('auth.magic_link_button')
            )}
          </Button>
        </form>

        {/* Google path — always shown */}
        <div className="mt-3">
          <GoogleSignInButton />
        </div>
      </div>

      <EnvBadge />
    </div>
  );
}
