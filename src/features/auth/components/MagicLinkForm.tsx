/**
 * features/auth/components/MagicLinkForm.tsx
 *
 * Passwordless email sign-in form. Sends a magic link via Supabase OTP.
 * Single field (email) + submit button + subtle hint text.
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
});
type FormValues = z.infer<typeof schema>;

interface MagicLinkFormProps {
  /** Pre-filled email value (preserved when switching from password mode). */
  defaultEmail?: string;
  /** Called when user wants to switch to password mode. Receives current email. */
  onSwitchToPassword: (email: string) => void;
}

export default function MagicLinkForm({ defaultEmail, onSwitchToPassword }: MagicLinkFormProps) {
  const { t } = useTranslation();
  const { signInWithMagicLink } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail ?? '' },
  });

  const onSubmit = async ({ email }: FormValues) => {
    setServerError(null);
    try {
      await signInWithMagicLink(email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('rate') || msg.includes('limit')) {
        setServerError(t('auth.error_rate_limited'));
      } else {
        setServerError(t('auth.error_magic_link'));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-4" noValidate>
      {/* Form heading */}
      <div className="space-y-0.5">
        <h2 className="text-lg font-semibold text-foreground">{t('auth.sign_in_title')}</h2>
        <p className="text-sm text-muted-foreground">{t('auth.magic_link_hint')}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="magic-email">{t('auth.email')}</Label>
        <Input
          id="magic-email"
          type="email"
          autoComplete="email"
          placeholder={t('auth.email_placeholder')}
          className="h-11 bg-card"
          {...register('email')}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('auth.magic_link_sending')}
          </>
        ) : (
          t('auth.magic_link_button')
        )}
      </Button>

      {serverError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
          {serverError}
        </p>
      )}

      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={() => onSwitchToPassword(getValues('email'))}
          className="w-full rounded-md py-2 text-center text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
        >
          {t('auth.use_password')}
        </button>
      </div>
    </form>
  );
}
