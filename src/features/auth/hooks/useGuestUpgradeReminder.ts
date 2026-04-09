/**
 * features/auth/hooks/useGuestUpgradeReminder.ts
 *
 * Throttled trigger for the guest-upgrade reminder dialog.
 *
 * The reminder is a soft nudge that appears after a guest (anonymous) user
 * successfully completes a meaningful action (create group, add expense, add
 * friend, accept invite). It prompts them to create a real account so their
 * data does not get lost on reinstall.
 *
 * Throttling rules:
 *   - No-op if the current session is not anonymous.
 *   - At most once per session (tracked via uiStore.guestReminderShownThisSession).
 *   - The flag is in-memory and resets every app open.
 *
 * Usage in a component that renders the dialog:
 *
 *   const { showReminder, dismissReminder, triggerReminder } = useGuestUpgradeReminder();
 *   // ...call triggerReminder() from a mutation onSuccess
 *   {showReminder && <GuestUpgradeDialog variant="reminder" onDismiss={dismissReminder} />}
 *
 * Usage in a mutation hook (fire-and-forget, no local dialog render):
 *   import { triggerGuestUpgradeReminderFromStore } from './useGuestUpgradeReminder';
 *   // ...inside onSuccess: triggerGuestUpgradeReminderFromStore();
 */

import { useCallback, useState } from 'react';
import { useUIStore } from '../../../store/uiStore';
import { useAuthStore } from '../authStore';

/**
 * Imperative, store-only trigger. Call from non-React contexts (e.g. inside a
 * TanStack Query mutation `onSuccess` that doesn't render a dialog locally).
 * Sets the "shown this session" throttle flag AND the "open" flag so the
 * top-level dialog renderer (AppShell) can pick up the request and mount the
 * dialog. Returns true if the reminder will be shown, false if it was throttled.
 */
export function triggerGuestUpgradeReminderFromStore(): boolean {
  const session = useAuthStore.getState().session;
  if (!session?.user?.is_anonymous) return false;
  const { guestReminderShownThisSession, setGuestReminderShown, setGuestReminderOpen } =
    useUIStore.getState();
  if (guestReminderShownThisSession) return false;
  setGuestReminderShown(true);
  setGuestReminderOpen(true);
  return true;
}

export const useGuestUpgradeReminder = () => {
  const isAnonymous = useAuthStore((s) => s.session?.user?.is_anonymous ?? false);
  const [showReminder, setShowReminder] = useState(false);

  const triggerReminder = useCallback(() => {
    if (!isAnonymous) return;
    const { guestReminderShownThisSession, setGuestReminderShown } = useUIStore.getState();
    if (guestReminderShownThisSession) return;
    setGuestReminderShown(true);
    setShowReminder(true);
  }, [isAnonymous]);

  const dismissReminder = useCallback(() => {
    setShowReminder(false);
  }, []);

  return { showReminder, dismissReminder, triggerReminder };
};
