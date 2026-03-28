/**
 * App.tsx
 *
 * Root application component. Sets up all global providers in the correct order:
 *
 *   1. I18nextProvider          — i18n context (must wrap everything)
 *   2. PersistQueryClientProvider — TanStack Query with IndexedDB persistence
 *   3. RouterProvider           — TanStack Router
 *
 * Also responsible for:
 *   - Subscribing to Supabase onAuthStateChange and syncing to authStore
 *   - Initialising push notifications (Android) and routing taps to the right screen
 *   - Starting the sync service (lib/storage/syncService.ts)
 *   - Nothing else — keep this file thin
 */

import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import SplashScreen from './components/SplashScreen';

import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './features/auth/authStore';
import { type NotificationData, initPushNotifications } from './lib/capacitor/pushNotifications';
import { initStatusBar } from './lib/capacitor/statusBar';
import { checkInstallReferrer } from './lib/installReferrer';
import { CACHE_MAX_AGE, idbPersister } from './lib/storage/queryPersister';
import { supabase } from './lib/supabase/client';
import { friendRepository } from './repositories';
import { deletePushToken, upsertPushToken } from './repositories/supabase/pushTokenRepository';
import { router } from './router';
import { usePendingInviteStore } from './store/pendingInviteStore';

/**
 * Accepts an invite token, invalidates the friends query, and navigates to /friends.
 * Used by deep link handler and pending invite check.
 */
async function processInviteToken(token: string, queryClient: QueryClient) {
  try {
    await friendRepository.acceptInvite(token);
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    router.navigate({ to: '/friends' });
  } catch {
    // Token may be expired, already used, or already friends — navigate anyway
    router.navigate({ to: '/friends' });
  }
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 min — fresh data, background refetch after
            gcTime: CACHE_MAX_AGE,
          },
        },
      }),
  );

  const { setSession, setHydrated, isHydrated } = useAuthStore();
  // Track the current FCM token so we can delete it on sign-out.
  const currentPushToken = useRef<string | null>(null);

  // Initialise Android status bar style (icon colour + background) on startup.
  // Runs before auth hydration so it takes effect as early as possible.
  // Automatically updates when the user switches dark/light mode.
  useEffect(() => {
    void initStatusBar();
  }, []);

  // Handle deep links from email confirmation (custom URI scheme: com.pfennig50.app://auth/callback).
  // Supports both PKCE (?code=) and implicit (#access_token=) Supabase auth flows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect — captures stable module-level refs
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleDeepLinkUrl = async (url: string) => {
      try {
        const urlObj = new URL(url);

        // --- Invite deep link: com.arco.sharli://invite/f/{token} ---
        const inviteMatch = urlObj.pathname.match(/\/f\/([A-Z0-9]{6})$/) ?? null;

        if (inviteMatch?.[1]) {
          const token = inviteMatch[1];
          const session = useAuthStore.getState().session;
          if (session) {
            // User is logged in — accept the invite immediately
            await processInviteToken(token, queryClient);
          } else {
            // Not logged in — store token for after login
            usePendingInviteStore.getState().setToken(token);
          }
          return;
        }

        // --- Auth callback deep link ---
        // PKCE flow: Supabase passes ?code= query param
        const code = urlObj.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            void Browser.close().catch(() => {}); // dismiss OAuth browser tab if open
            router.navigate({ to: '/home' });
          }
          return;
        }
        // Implicit flow: tokens are in the URL fragment
        const hash = new URLSearchParams(urlObj.hash.substring(1));
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) {
            void Browser.close().catch(() => {}); // dismiss OAuth browser tab if open
            router.navigate({ to: '/home' });
          }
        }
      } catch {
        // Ignore malformed URLs or non-auth deep links
      }
    };

    // Cold-start: app launched directly by tapping the email link
    CapacitorApp.getLaunchUrl().then((result) => {
      if (result?.url) handleDeepLinkUrl(result.url);
    });
    // Warm-start: app already running when the deep link arrives
    CapacitorApp.addListener('appUrlOpen', ({ url }) => handleDeepLinkUrl(url));

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  // Subscribe to Supabase auth changes. The first callback fires on mount
  // (even when offline) and tells us whether a session exists — that's when
  // we set isHydrated so the router can start running its guards.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect — queryClient, setSession, setHydrated are stable refs
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && currentPushToken.current) {
        // Token arrived before login (e.g. fresh install) — save it now.
        void upsertPushToken(currentPushToken.current);
      }

      if (event === 'SIGNED_OUT') {
        // Remove this device's push token so the user stops receiving
        // notifications after signing out.
        if (currentPushToken.current) {
          void deletePushToken(currentPushToken.current);
          currentPushToken.current = null;
        }
        // Wipe the in-memory cache and the IndexedDB snapshot so the next
        // user never sees stale data from the previous session.
        queryClient.clear();
        idbPersister.removeClient();
      }
      setSession(session);
      setHydrated();
    });
    return () => subscription.unsubscribe();
  }, []);

  // Initialise push notifications on Android.
  // Must run after auth is hydrated so that upsertPushToken can resolve the user.
  useEffect(() => {
    if (!isHydrated) return;

    const handleToken = (token: string) => {
      currentPushToken.current = token;
      void upsertPushToken(token);
    };

    const handleTap = (data: NotificationData) => {
      // Navigate to the relevant screen when the user taps a notification.
      if (data.type === 'expense') {
        if (data.groupId) {
          void router.navigate({ to: '/groups/$groupId', params: { groupId: data.groupId } });
        } else if (data.friendId) {
          void router.navigate({ to: '/friends/$friendId', params: { friendId: data.friendId } });
        }
      } else if (data.type === 'group_member' && data.groupId) {
        void router.navigate({ to: '/groups/$groupId', params: { groupId: data.groupId } });
      }
    };

    let cleanup = () => {};
    initPushNotifications(handleToken, handleTap).then((fn) => {
      cleanup = fn;
    });

    return () => cleanup();
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for pending invite tokens after auth hydration.
  // Two sources: (1) pendingInviteStore (from deep link before login),
  //              (2) Play Store install referrer (deferred deep link).
  useEffect(() => {
    if (!isHydrated) return;
    const session = useAuthStore.getState().session;
    if (!session) return;

    // 1. Check pending invite store (deep link arrived before login)
    const pendingToken = usePendingInviteStore.getState().token;
    if (pendingToken) {
      usePendingInviteStore.getState().clear();
      void processInviteToken(pendingToken, queryClient);
      return;
    }

    // 2. Check Play Store install referrer (deferred deep link after install)
    void checkInstallReferrer().then((token) => {
      if (token) void processInviteToken(token, queryClient);
    });
  }, [isHydrated, queryClient]);

  // Track whether the splash screen has finished its exit animation
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  // Show splash until both: auth is hydrated AND the splash animation is done
  const showSplash = !splashDone;

  return (
    <>
      {/* Splash sits on top of everything until its exit animation completes */}
      {showSplash && <SplashScreen exiting={isHydrated} onDone={handleSplashDone} />}

      {/* Mount the real app tree immediately so queries/auth can warm up,
          but it is visually hidden behind the splash screen */}
      {isHydrated && (
        <ErrorBoundary>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: idbPersister, maxAge: CACHE_MAX_AGE }}
          >
            <RouterProvider router={router} context={{ queryClient }} />
          </PersistQueryClientProvider>
        </ErrorBoundary>
      )}
    </>
  );
}
