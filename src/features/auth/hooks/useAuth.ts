/**
 * features/auth/hooks/useAuth.ts
 *
 * Hook that exposes auth state and actions to components.
 *
 * Provides:
 *   - currentUser: the authenticated user (or null)
 *   - isLoading: true while session is hydrating
 *   - signIn(email, password): Supabase email/password sign-in
 *   - signInWithGoogle(): OAuth sign-in
 *   - signOut(): clears session and redirects to /login
 */

import { useCallback } from 'react';
import { useRouter } from '@tanstack/react-router';
import { supabase } from '../../../lib/supabase/client';
import { useAuthStore } from '../authStore';

export const useAuth = () => {
  const router  = useRouter();
  const session = useAuthStore(s => s.session);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await router.navigate({ to: '/groups' });
  }, [router]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    await router.navigate({ to: '/groups' });
  }, [router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await router.navigate({ to: '/login' });
  }, [router]);

  const updateDisplayName = useCallback(async (name: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name.trim() },
    });
    if (error) throw error;
    // onAuthStateChange fires USER_UPDATED → authStore.setSession() auto-updates
  }, []);

  return {
    user:    session?.user ?? null,
    session,
    signIn,
    signUp,
    signOut,
    updateDisplayName,
  };
};
