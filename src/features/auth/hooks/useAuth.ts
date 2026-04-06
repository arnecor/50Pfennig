/**
 * features/auth/hooks/useAuth.ts
 *
 * Hook that exposes auth state and actions to components.
 *
 * Provides:
 *   - currentUser: the authenticated user (or null)
 *   - isLoading: true while session is hydrating
 *   - signIn(email, password): Supabase email/password sign-in
 *   - signInWithGoogle(): OAuth sign-in via system browser
 *   - signInWithMagicLink(email): passwordless email sign-in
 *   - signOut(): clears session and redirects to /login
 */

import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { useAuthStore } from '../authStore';

export const useAuth = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await router.navigate({ to: '/home' });
    },
    [router],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'com.arco.sharli://auth/callback',
          ...(displayName ? { data: { display_name: displayName } } : {}),
        },
      });
      if (error) throw error;
      await router.navigate({
        to: '/auth/check-email',
        search: { email, type: 'signup' as const },
      });
    },
    [router],
  );

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Capacitor.isNativePlatform()
      ? 'com.arco.sharli://auth/callback'
      : `${window.location.origin}/home`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: Capacitor.isNativePlatform(),
      },
    });
    if (error) throw error;

    if (Capacitor.isNativePlatform() && data.url) {
      await Browser.open({ url: data.url });
    }
  }, []);

  const signInWithMagicLink = useCallback(
    async (email: string) => {
      const emailRedirectTo = Capacitor.isNativePlatform()
        ? 'com.arco.sharli://auth/callback'
        : `${window.location.origin}/home`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      await router.navigate({
        to: '/auth/check-email',
        search: { email, type: 'magic_link' },
      });
    },
    [router],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await router.navigate({ to: '/login' });
  }, [router]);

  const updateDisplayName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!session?.user?.id) throw new Error('Not authenticated');

      // profiles is the canonical DB record for display names
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (profileError) throw profileError;

      // Keep auth metadata in sync so the session user object stays current
      // (used by greeting and "Paid by" label which read user.user_metadata)
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: trimmed },
      });
      if (authError) throw authError;
      // onAuthStateChange fires USER_UPDATED → authStore.setSession() auto-updates

      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    [session?.user?.id, queryClient],
  );

  return {
    user: session?.user ?? null,
    session,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
    updateDisplayName,
  };
};
