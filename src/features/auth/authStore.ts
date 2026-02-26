/**
 * features/auth/authStore.ts
 *
 * Zustand store for authentication state.
 *
 * Holds the Supabase session and a hydration flag.
 * The isHydrated flag is false until onAuthStateChange fires for the
 * first time — this prevents a flash of the login screen on startup
 * while the session is being restored from storage.
 *
 * Kept separate from uiStore because auth state is used in guards,
 * repository layers, and the sync service — not just UI components.
 */

import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

type AuthStore = {
  session:     Session | null;
  isHydrated:  boolean;
  setSession:  (session: Session | null) => void;
  setHydrated: () => void;
};

export const useAuthStore = create<AuthStore>()((set) => ({
  session:     null,
  isHydrated:  false,
  setSession:  (session) => set({ session }),
  setHydrated: () => set({ isHydrated: true }),
}));
