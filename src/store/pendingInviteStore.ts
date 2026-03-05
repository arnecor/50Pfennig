/**
 * store/pendingInviteStore.ts
 *
 * Holds a pending invite token when a deep link arrives but the user
 * is not yet logged in. After auth hydration with a valid session,
 * App.tsx checks for a pending token and auto-accepts the invite.
 *
 * Also persists to localStorage as a safety net — the app may be killed
 * during the signup flow (e.g. when redirecting to Play Store).
 */

import { create } from 'zustand';

const STORAGE_KEY = '50pfennig_pending_invite_token';

type PendingInviteStore = {
  token: string | null;
  setToken: (token: string) => void;
  clear: () => void;
};

export const usePendingInviteStore = create<PendingInviteStore>()((set) => ({
  token: localStorage.getItem(STORAGE_KEY),

  setToken: (token) => {
    localStorage.setItem(STORAGE_KEY, token);
    set({ token });
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null });
  },
}));
