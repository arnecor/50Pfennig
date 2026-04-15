/**
 * features/auth/components/GuestUpgradeDialog.tsx
 *
 * Shared modal shown to Supabase anonymous (guest) users to encourage account
 * creation. Two variants driven by the `variant` prop:
 *
 *   - "gate"     → hard gate on features that require an email identity
 *                  (e.g. /friends/add). Rendered in place of the page content;
 *                  dismissing returns the user to the previous page.
 *   - "reminder" → soft nudge after a successful action (create group, add
 *                  expense, add friend). Throttled to once per session by
 *                  useGuestUpgradeReminder.
 *
 * Both variants offer the same two actions:
 *   - "Später"           → calls onDismiss
 *   - "Account erstellen" → navigates to /account (AccountPage renders the
 *                           upgrade form when isAnonymous is true)
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
import { useBackHandler } from '@lib/capacitor/backHandler';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export type GuestUpgradeDialogVariant = 'gate' | 'reminder';

interface GuestUpgradeDialogProps {
  variant: GuestUpgradeDialogVariant;
  /**
   * Called when "Später" is tapped. For variant="gate", the caller typically
   * navigates back to the previous page so the user isn't stranded on a
   * dialog-only screen. For variant="reminder", it just closes the dialog.
   */
  onDismiss?: () => void;
}

export default function GuestUpgradeDialog({ variant, onDismiss }: GuestUpgradeDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
      return;
    }
    if (variant === 'gate') {
      router.history.back();
    }
  };

  useBackHandler(() => {
    handleDismiss();
    return true;
  });

  const handleCreateAccount = () => {
    void navigate({ to: '/account' });
  };

  const title = t(variant === 'gate' ? 'auth.guest_gate_title' : 'auth.guest_reminder_title');
  const body = t(variant === 'gate' ? 'auth.guest_gate_body' : 'auth.guest_reminder_body');

  return (
    <Dialog open onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button variant="ghost" onClick={handleDismiss} className="sm:flex-none">
            {t('auth.guest_later')}
          </Button>
          <Button onClick={handleCreateAccount} className="sm:flex-none">
            {t('auth.guest_create_account')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
