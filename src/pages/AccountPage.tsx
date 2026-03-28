/**
 * pages/AccountPage.tsx
 *
 * Route: /account
 *
 * Profile and account settings. Sign out.
 */

import { PageHeader } from '@/components/shared/PageHeader';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import {
  Check,
  ChevronRight,
  FileText,
  Globe,
  HelpCircle,
  LogOut,
  MessageSquare,
  Pencil,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

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
  const { user, updateDisplayName, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentDisplayName: string =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

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
