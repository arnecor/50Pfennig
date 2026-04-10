/**
 * pages/AccountPage.tsx
 *
 * Route: /account
 *
 * Profile and account settings. Sign out.
 *
 * Guest users see a focused upgrade view instead of the normal profile:
 *   - Only the upgrade form (email + optional password + login-link toggle)
 *   - Google linking (if VITE_ENABLE_GOOGLE_LOGIN is set)
 *   - An "Als Gast beenden" sign-out link at the bottom
 * The normal profile/language/help/sign-out sections reappear automatically
 * once the upgrade is confirmed and `is_anonymous` flips to false.
 */

import { PageHeader } from '@/components/shared/PageHeader';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GoogleSignInButton from '@/features/auth/components/GoogleSignInButton';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import {
  Check,
  ChevronRight,
  FileText,
  Globe,
  HelpCircle,
  Loader2,
  LogOut,
  MailCheck,
  MessageSquare,
  Pencil,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

const GOOGLE_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true';
const PASSWORD_MIN_LENGTH = 6;

type UpgradeAuthMode = 'password' | 'login_link';

const displayNameSchema = z.object({
  displayName: z.string().min(1, 'Required').max(50),
});
type DisplayNameFormValues = z.infer<typeof displayNameSchema>;

/** A single row in a settings list */
function SettingsRow({
  label,
  value,
  onClick,
  children,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'flex items-center justify-between w-full px-5 py-3.5 text-left',
        onClick ? 'hover:bg-muted/60 active:bg-muted transition-colors' : '',
      ].join(' ')}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {value && <span className="truncate max-w-[140px]">{value}</span>}
        {children}
        {onClick && <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />}
      </span>
    </Tag>
  );
}

/** A section heading that labels a group of rows */
function SectionLabel({ label, tight }: { label: string; tight?: boolean }) {
  return (
    <p
      className={`px-5 pb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground ${tight ? 'pt-2' : 'pt-5'}`}
    >
      {label}
    </p>
  );
}

/** A grouped block of rows with a card-like surface and dividers */
function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
      {children}
    </div>
  );
}

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user, isAnonymous, updateDisplayName, upgradeGuestWithEmail, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentDisplayName: string =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

  // --- Guest upgrade view -------------------------------------------------
  if (isAnonymous) {
    return <GuestUpgradeView onExit={signOut} upgradeGuest={upgradeGuestWithEmail} />;
  }

  const [isEditing, setIsEditing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DisplayNameFormValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: currentDisplayName },
  });

  const onSubmit = async ({ displayName }: DisplayNameFormValues) => {
    setServerError(null);
    try {
      await updateDisplayName(displayName);
      setIsEditing(false);
      reset({ displayName });
    } catch {
      setServerError(t('account.error_update_failed'));
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setServerError(null);
    reset({ displayName: currentDisplayName });
  };

  return (
    <div className="min-h-full pb-24 font-sans">
      <PageHeader title={t('account.title')} />

      {/* Avatar hero */}
      <div className="flex flex-col items-center gap-2 pt-3 pb-3">
        <div className="relative">
          <UserAvatar name={currentDisplayName} size="xl" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-background"
            aria-label={t('account.profile_picture_label')}
          >
            <Pencil className="h-3 w-3 text-primary-foreground" />
          </button>
          {/* Hidden file input — wired up but no-op until backend supports it */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
          />
        </div>
        <p className="text-base font-semibold text-foreground">{currentDisplayName}</p>
      </div>

      {/* Profile section */}
      <SectionLabel label={t('account.profile_section_title')} tight />
      <SettingsGroup>
        {/* Display name */}
        {!isEditing ? (
          <SettingsRow
            label={t('account.display_name_label')}
            value={currentDisplayName}
            onClick={() => setIsEditing(true)}
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-3">
            <p className="text-xs text-muted-foreground mb-1.5">
              {t('account.display_name_label')}
            </p>
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                maxLength={50}
                placeholder={t('account.display_name_placeholder')}
                className="h-9 text-sm"
                {...register('displayName')}
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                disabled={isSubmitting}
                aria-label={t('account.save_display_name_aria')}
                className="shrink-0 h-9 w-9"
              >
                {isSubmitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isSubmitting}
                aria-label={t('account.cancel_edit_aria')}
                onClick={handleCancelEdit}
                className="shrink-0 h-9 w-9"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {(errors.displayName || serverError) && (
              <p className="text-destructive text-xs mt-1.5">
                {errors.displayName?.message ?? serverError}
              </p>
            )}
          </form>
        )}

        {/* Email — read-only */}
        <SettingsRow label={t('account.email_label')} value={user?.email ?? ''} />
      </SettingsGroup>

      {/* Language section */}
      <SectionLabel label={t('account.language_section_title')} />
      <SettingsGroup>
        <label className="flex items-center justify-between px-5 py-3.5 cursor-pointer">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Globe className="h-4 w-4 text-muted-foreground" />
            {t('account.language_select_label')}
          </span>
          <div className="relative flex items-center gap-1 text-sm text-muted-foreground">
            <span>
              {i18n.language === 'de' ? t('account.language_de') : t('account.language_en')}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              aria-label={t('account.language_select_label')}
              className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
            >
              <option value="de">{t('account.language_de')}</option>
              <option value="en">{t('account.language_en')}</option>
            </select>
          </div>
        </label>
      </SettingsGroup>

      {/* Help section */}
      <SectionLabel label={t('account.help_section_title')} />
      <SettingsGroup>
        <SettingsRow
          label={t('account.support_link')}
          onClick={() => window.open('https://vercel.com/help', '_blank')}
        >
          <HelpCircle className="h-4 w-4 opacity-40" />
        </SettingsRow>
        <SettingsRow
          label={t('account.feedback_link')}
          onClick={() => window.open('https://vercel.com/help', '_blank')}
        >
          <MessageSquare className="h-4 w-4 opacity-40" />
        </SettingsRow>
        <SettingsRow
          label={t('account.imprint_link')}
          onClick={() => navigate({ to: '/account/imprint' })}
        >
          <FileText className="h-4 w-4 opacity-40" />
        </SettingsRow>
      </SettingsGroup>

      {/* Sign out */}
      <div className="mx-4 mt-8">
        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/15 active:bg-destructive/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t('auth.sign_out')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest upgrade view — shown on /account while the current session is anonymous
// ---------------------------------------------------------------------------

interface GuestUpgradeViewProps {
  onExit: () => void | Promise<void>;
  upgradeGuest: (email: string, password?: string) => Promise<void>;
}

function GuestUpgradeView({ onExit, upgradeGuest }: GuestUpgradeViewProps) {
  const { t } = useTranslation();

  const [authMode, setAuthMode] = useState<UpgradeAuthMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [sentMode, setSentMode] = useState<UpgradeAuthMode | null>(null);

  const emailTrimmed = email.trim();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
  const passwordValid = password.length >= PASSWORD_MIN_LENGTH;
  const formValid = authMode === 'password' ? emailLooksValid && passwordValid : emailLooksValid;

  const translateAuthError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('already registered') || msg.includes('already been registered'))
      return t('auth.error_email_taken');
    if (msg.includes('Password should be')) return t('auth.error_weak_password');
    if (msg.includes('rate') || msg.includes('limit')) return t('auth.error_rate_limited');
    return t('common.error_generic');
  };

  const handleUpgradeSubmit = async () => {
    if (!formValid || isSubmitting) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      await upgradeGuest(emailTrimmed, authMode === 'password' ? password : undefined);
      setSentToEmail(emailTrimmed);
      setSentMode(authMode);
    } catch (err) {
      setServerError(translateAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExit = () => {
    void onExit();
  };

  // Success state — verification email sent
  if (sentToEmail) {
    return (
      <div className="min-h-full pb-24 font-sans">
        <PageHeader title={t('account.upgrade_title')} />
        <div className="flex flex-col items-center gap-5 px-6 pt-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              {t('account.upgrade_success_title')}
            </h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t(
                sentMode === 'login_link'
                  ? 'account.upgrade_magic_link_success_body'
                  : 'account.upgrade_success_body',
                { email: sentToEmail },
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24 font-sans">
      <PageHeader title={t('account.upgrade_title')} />

      <div className="mx-4 mt-2 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
        <p className="mb-5 text-sm text-muted-foreground">{t('account.upgrade_body')}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleUpgradeSubmit();
          }}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-email">{t('auth.email')}</Label>
            <Input
              id="upgrade-email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder={t('auth.email_placeholder')}
              className="h-11 bg-background"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {authMode === 'password' ? (
            <div className="space-y-1.5">
              <Label htmlFor="upgrade-password">{t('auth.password')}</Label>
              <Input
                id="upgrade-password"
                type="password"
                autoComplete="new-password"
                placeholder={t('auth.password_placeholder')}
                className="h-11 bg-background"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('auth.password_min_hint')}</p>
            </div>
          ) : (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {t('auth.magic_link_hint')}
            </p>
          )}

          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="h-11 w-full" disabled={!formValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.signing_in')}
              </>
            ) : authMode === 'password' ? (
              t('onboarding.create_account')
            ) : (
              t('auth.magic_link_button')
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setServerError(null);
              setAuthMode(authMode === 'password' ? 'login_link' : 'password');
            }}
            className="w-full py-1 text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t(authMode === 'password' ? 'auth.use_magic_link' : 'auth.use_password')}
          </button>
        </form>

        {GOOGLE_LOGIN_ENABLED && (
          <>
            <div className="my-5 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('auth.or_divider')}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <GoogleSignInButton mode="link" />
          </>
        )}
      </div>

      <div className="mx-4 mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleExit}
          className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-destructive hover:underline"
        >
          {t('account.exit_as_guest')}
        </button>
      </div>
    </div>
  );
}
