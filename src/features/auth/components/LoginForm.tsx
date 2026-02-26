/**
 * features/auth/components/LoginForm.tsx
 *
 * Email + password login form with a link to sign up.
 * Uses React Hook Form + Zod for validation.
 * Calls useAuth().signIn() on submit.
 *
 * Also renders OAuth buttons (Google) via OAuthButtons component.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { Input }  from '../../../components/ui/input';
import { Label }  from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { useAuth } from '../hooks/useAuth';

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});
type FormValues = z.infer<typeof schema>;

export default function LoginForm() {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const [mode, setMode]               = useState<'sign_in' | 'sign_up'>('sign_in');
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

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
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">
          {t(isSignIn ? 'auth.sign_in_title' : 'auth.sign_up_title')}
        </CardTitle>
        <CardDescription>
          {t(isSignIn ? 'auth.sign_in_subtitle' : 'auth.sign_up_subtitle')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('auth.email_placeholder')}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              placeholder={t('auth.password_placeholder')}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-destructive text-sm">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-destructive text-sm">{serverError}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t(isSignIn ? 'auth.sign_in' : 'auth.sign_up')}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(isSignIn ? 'sign_up' : 'sign_in'); setServerError(null); }}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t(isSignIn ? 'auth.switch_to_sign_up' : 'auth.switch_to_sign_in')}
        </button>
      </CardContent>
    </Card>
  );
}
