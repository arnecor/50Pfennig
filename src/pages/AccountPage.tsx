/**
 * pages/AccountPage.tsx
 *
 * Route: /account
 *
 * Profile and account settings. Sign out.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Pencil, Check, X, LogOut, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/hooks/useAuth';

const displayNameSchema = z.object({
  displayName: z.string().min(1, 'Required').max(50),
});
type DisplayNameFormValues = z.infer<typeof displayNameSchema>;

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user, updateDisplayName, signOut } = useAuth();

  const currentDisplayName: string =
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    '';

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
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">{t('account.title')}</h1>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('account.profile_section_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Email — read-only */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('account.email_label')}</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate">{user?.email}</span>
            </div>
          </div>

          {/* Display name — view mode */}
          {!isEditing && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('account.display_name_label')}</Label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{currentDisplayName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('account.edit_display_name_aria')}
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Display name — edit mode */}
          {isEditing && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
              <Label htmlFor="displayName">{t('account.display_name_label')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="displayName"
                  autoFocus
                  maxLength={50}
                  placeholder={t('account.display_name_placeholder')}
                  {...register('displayName')}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  disabled={isSubmitting}
                  aria-label={t('account.save_display_name_aria')}
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
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {errors.displayName && (
                <p className="text-destructive text-sm">{errors.displayName.message}</p>
              )}
              {serverError && (
                <p className="text-destructive text-sm">{serverError}</p>
              )}
            </form>
          )}

        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('account.language_section_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={i18n.language === 'de' ? 'default' : 'outline'}
              size="sm"
              onClick={() => i18n.changeLanguage('de')}
            >
              {t('account.language_de')}
            </Button>
            <Button
              variant={i18n.language === 'en' ? 'default' : 'outline'}
              size="sm"
              onClick={() => i18n.changeLanguage('en')}
            >
              {t('account.language_en')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('account.session_section_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('auth.sign_out')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
