/**
 * store/uiStore.ts
 *
 * Global UI state — things that are ephemeral, device-local, and do not
 * belong on the server.
 *
 * What belongs here:
 *   - Which group is currently selected
 *   - Which bottom sheet is open (add expense, record settlement, etc.)
 *   - Partial form drafts (survive navigation, cleared on submit)
 *
 * What does NOT belong here:
 *   - Group data, expense data, member lists → TanStack Query
 *   - Computed balances → derived in hooks via useMemo from TQ data
 *   - Auth session → authStore (features/auth/authStore.ts)
 *   - Offline queue → offlineStore (store/offlineStore.ts)
 *   - Navigation history → TanStack Router
 */

import { create } from 'zustand';
import type { GroupId } from '../domain/types';

type ActiveSheet = 'add-expense' | 'record-settlement' | 'add-member' | null;

type UIStore = {
  selectedGroupId: GroupId | null;
  setSelectedGroupId: (id: GroupId | null) => void;

  activeSheet: ActiveSheet;
  openSheet: (sheet: NonNullable<ActiveSheet>) => void;
  closeSheet: () => void;

  /**
   * Whether the guest-upgrade reminder dialog has already been shown in the
   * current session. Used by useGuestUpgradeReminder to throttle the reminder
   * to once per session regardless of how many qualifying mutations succeed.
   * Not persisted — Zustand in-memory only, resets on every app open.
   */
  guestReminderShownThisSession: boolean;
  setGuestReminderShown: (val: boolean) => void;

  /**
   * Whether the global guest-upgrade reminder dialog should currently be open.
   * Set to true by triggerGuestUpgradeReminderFromStore() and consumed by the
   * top-level renderer (AppShell) to mount the dialog. Cleared when the user
   * dismisses the dialog. Decoupled from `guestReminderShownThisSession` so
   * the throttle persists even after the dialog closes.
   */
  guestReminderOpen: boolean;
  setGuestReminderOpen: (val: boolean) => void;
};

export const useUIStore = create<UIStore>()((set) => ({
  selectedGroupId: null,
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),
  activeSheet: null,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  guestReminderShownThisSession: false,
  setGuestReminderShown: (val) => set({ guestReminderShownThisSession: val }),
  guestReminderOpen: false,
  setGuestReminderOpen: (val) => set({ guestReminderOpen: val }),
}));
