/**
 * features/auth/hooks/useAuth.ts
 *
 * Hook that exposes auth state and actions to components.
 *
 * Provides:
 *   - currentUser: the authenticated user (or null)
 *   - isAnonymous: true when the current session is a Supabase anonymous (guest) user
 *   - signIn(email, password): Supabase email/password sign-in
 *   - signInWithGoogle(): OAuth sign-in via system browser
 *   - linkGoogleIdentity(): attaches a Google identity to the CURRENT session,
 *     used from the guest-upgrade flow on AccountPage. Unlike signInWithGoogle,
 *     this does not create a new user — user.id stays the same.
 *   - signInWithMagicLink(email, displayName?): passwordless email sign-in. When
 *     displayName is passed AND the email does not yet have an account, Supabase
 *     stores it in raw_user_meta_data on the newly created row so the
 *     handle_new_user trigger writes it into profiles automatically.
 *   - signInAsGuest(displayName): creates a Supabase anonymous user whose
 *     display_name is set at row-insert time (trigger reads raw_user_meta_data).
 *   - upgradeGuestWithEmail(email, password?): attaches email (and optionally a
 *     password) to the current anonymous session. Supabase sends a confirmation
 *     email; once the user clicks the link, is_anonymous flips to false. The
 *     user.id stays the same, so all guest data is preserved automatically.
 *     Omit `password` for the login-link upgrade variant.
 *   - signOut(): clears session and redirects to /login
 */

import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { resizeImage } from '../../../lib/image/resizeImage';
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

  const linkGoogleIdentity = useCallback(async () => {
    const redirectTo = Capacitor.isNativePlatform()
      ? 'com.arco.sharli://auth/callback'
      : `${window.location.origin}/home`;

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: Capacitor.isNativePlatform(),
      },
    });
    if (error) throw error;

    if (Capacitor.isNativePlatform() && data?.url) {
      await Browser.open({ url: data.url });
    }
  }, []);

  const signInWithMagicLink = useCallback(
    async (email: string, displayName?: string) => {
      const emailRedirectTo = Capacitor.isNativePlatform()
        ? 'com.arco.sharli://auth/callback'
        : `${window.location.origin}/home`;

      // For new users (onboarding flow), displayName is passed via options.data.
      // Supabase writes it to raw_user_meta_data on the newly created auth.users
      // row, so the handle_new_user trigger reads it into profiles on INSERT.
      // For existing users, Supabase ignores data, so their stored name stays.
      const trimmedName = displayName?.trim();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
          ...(trimmedName ? { data: { display_name: trimmedName } } : {}),
        },
      });
      if (error) throw error;
      await router.navigate({
        to: '/auth/check-email',
        search: { email, type: 'magic_link' },
      });
    },
    [router],
  );

  const signInAsGuest = useCallback(
    async (displayName: string) => {
      const trimmedName = displayName.trim();
      // Pass display_name via options.data so the handle_new_user trigger
      // writes it on INSERT — this avoids a race between signInAnonymously
      // and a follow-up updateUser call.
      const { error } = await supabase.auth.signInAnonymously(
        trimmedName ? { options: { data: { display_name: trimmedName } } } : undefined,
      );
      if (error) throw error;
      await router.navigate({ to: '/home' });
    },
    [router],
  );

  const upgradeGuestWithEmail = useCallback(async (email: string, password?: string) => {
    // Email upgrade of an anonymous session uses updateUser, NOT linkIdentity.
    // linkIdentity is for OAuth providers only. After updateUser, Supabase
    // sends a confirmation email; once confirmed, is_anonymous flips to false
    // and all data is preserved because user.id never changes.
    // Password is optional — omit it for the login-link upgrade variant.
    const { error } = await supabase.auth.updateUser(password ? { email, password } : { email });
    if (error) throw error;
  }, []);

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

  const uploadAvatar = useCallback(
    async (file: Blob) => {
      if (!session?.user?.id) throw new Error('Not authenticated');
      const userId = session.user.id;

      // Resize to 256×256 max and compress to JPEG (~30-50 KB)
      const resized = await resizeImage(file);

      const filePath = `${userId}/avatar`;

      // Upload to Supabase Storage (upsert overwrites previous avatar)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, resized, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      // Get public URL and append cache-bust timestamp
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // Update profiles table (source of truth for other users)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (profileError) throw profileError;

      // Dual-write to auth metadata (convenience for current user's own display)
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } }).catch(() => {
        // Non-critical — profiles table is the source of truth
      });

      // Invalidate caches so friends/groups refetch with new avatar
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    [session?.user?.id, queryClient],
  );

  return {
    user: session?.user ?? null,
    session,
    isAnonymous: session?.user?.is_anonymous ?? false,
    signIn,
    signUp,
    signInWithGoogle,
    linkGoogleIdentity,
    signInWithMagicLink,
    signInAsGuest,
    upgradeGuestWithEmail,
    signOut,
    updateDisplayName,
    uploadAvatar,
  };
};
