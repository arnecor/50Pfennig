/**
 * features/auth/components/EmailPasswordForm.tsx
 *
 * Traditional email + password sign-in / sign-up form.
 * Extracted from the original LoginForm.tsx.
 * Shown as a fallback when users toggle away from magic link mode.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useAuth } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type FormValues = z.infer<typeof schema>;

interface EmailPasswordFormProps {
  /** Pre-filled email value (preserved from magic link form). */
  defaultEmail?: string;
  /** Called when user wants to switch back to magic link mode. Receives current email. */
  onSwitchToMagicLink: (email: string) => void;
}

export default function EmailPasswordForm({
  defaultEmail,
  onSwitchToMagicLink,
}: EmailPasswordFormProps) {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail ?? '', password: '' },
  });

  const onSubmit = async ({ email, password }: FormValues) => {
    setServerError(null);
    try {
      if (mode === 'sign_in') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) {
        setServerError(t('auth.error_invalid_credentials'));
      } else if (msg.includes('already registered')) {
        setServerError(t('auth.error_email_taken'));
      } else if (msg.includes('Password should be')) {
        setServerError(t('auth.error_weak_password'));
      } else {
        setServerError(t('common.error_generic'));
      }
    }
  };

  const isSignIn = mode === 'sign_in';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="pw-email" className="sr-only">
          {t('auth.email')}
        </Label>
        <Input
          id="pw-email"
          type="email"
          autoComplete="email"
          placeholder={t('auth.email_placeholder')}
          className="h-11"
          {...register('email')}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pw-password" className="sr-only">
          {t('auth.password')}
        </Label>
        <Input
          id="pw-password"
          type="password"
          autoComplete={isSignIn ? 'current-password' : 'new-password'}
          placeholder={t('auth.password_placeholder')}
          className="h-11"
          {...register('password')}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      {serverError && <p className="text-center text-xs text-destructive">{serverError}</p>}

      <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('auth.signing_in')}
          </>
        ) : (
          t(isSignIn ? 'auth.sign_in' : 'auth.sign_up')
        )}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(isSignIn ? 'sign_up' : 'sign_in');
          setServerError(null);
        }}
        className="w-full py-1 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {t(isSignIn ? 'auth.switch_to_sign_up' : 'auth.switch_to_sign_in')}
      </button>

      <button
        type="button"
        onClick={() => onSwitchToMagicLink(getValues('email'))}
        className="w-full py-2 text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        {t('auth.use_magic_link')}
      </button>
    </form>
  );
}
