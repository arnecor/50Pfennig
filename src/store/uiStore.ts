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
  selectedGroupId:    GroupId | null;
  setSelectedGroupId: (id: GroupId | null) => void;

  activeSheet: ActiveSheet;
  openSheet:   (sheet: NonNullable<ActiveSheet>) => void;
  closeSheet:  () => void;
};

export const useUIStore = create<UIStore>()((set) => ({
  selectedGroupId:    null,
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),
  activeSheet:        null,
  openSheet:          (sheet) => set({ activeSheet: sheet }),
  closeSheet:         () => set({ activeSheet: null }),
}));
