/**
 * features/account/components/DeleteAccountDialog.tsx
 *
 * Confirmation dialog shown before the caller permanently deletes their
 * account. Rendered from AccountPage. The actual deletion is delegated to
 * `useAuth.deleteAccount()` which invokes the `delete-account` Edge Function
 * and signs the user out on success.
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const { deleteAccount } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteAccount();
      // On success the user is navigated to /login by deleteAccount; the
      // dialog unmounts with the AccountPage.
    } catch {
      setError(t('account.delete_failed'));
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (isDeleting) return; // lock while request is in flight
    if (!next) {
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isDeleting}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>{t('account.delete_warning_title')}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm leading-relaxed text-muted-foreground">
            <Trans
              i18nKey="account.delete_warning_body"
              components={{ strong: <strong className="font-semibold text-foreground" /> }}
            />
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            {t('account.delete_cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('account.delete_in_progress')}
              </>
            ) : (
              t('account.delete_confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
