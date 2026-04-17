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
 *   - Forwarding deep-link URLs and install referrer tokens into feature-level
 *     invite handlers (parsing + acceptance live in features/invites/)
 *   - Nothing else — keep this file thin
 */

import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './features/auth/authStore';
import { parseInviteToken } from './features/invites/lib/parseInviteToken';
import {
  processFriendInviteToken,
  processGroupInviteToken,
} from './features/invites/lib/processInviteAcceptance';
import { initBackHandler } from './lib/capacitor/backHandler';
import { type NotificationData, initPushNotifications } from './lib/capacitor/pushNotifications';
import { initStatusBar } from './lib/capacitor/statusBar';
import { initConnectivityService } from './lib/connectivity/connectivityService';
import { checkInstallReferrer } from './lib/installReferrer';
import { subscribeRealtime } from './lib/realtime/realtimeService';
import { clearOfflineQueue } from './lib/storage/offlineQueue';
import { CACHE_MAX_AGE, idbPersister } from './lib/storage/queryPersister';
import { initSyncService } from './lib/storage/syncService';
import { supabase } from './lib/supabase/client';
import { deletePushToken, upsertPushToken } from './repositories/supabase/pushTokenRepository';
import { router } from './router';
import { usePendingGroupInviteStore } from './store/pendingGroupInviteStore';
import { usePendingInviteStore } from './store/pendingInviteStore';

/**
 * Dispatches a parsed invite token to the correct acceptance handler.
 * Called from the deep-link handler and the pending-token check after login.
 */
async function dispatchInviteToken(input: string, queryClient: QueryClient): Promise<void> {
  const parsed = parseInviteToken(input);
  if (!parsed) return;

  if (parsed.type === 'friend') {
    await processFriendInviteToken(parsed.token, queryClient);
  } else {
    await processGroupInviteToken(parsed.token, queryClient);
  }
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // 30 s — fallback freshness; realtime + app-resume handle the rest
            gcTime: CACHE_MAX_AGE,
          },
        },
      }),
  );

  const { setSession, setHydrated, isHydrated } = useAuthStore();
  // Track the current FCM token so we can delete it on sign-out.
  const currentPushToken = useRef<string | null>(null);
  // Cleanup functions for the realtime channel and sync service listeners.
  const cleanupRealtime = useRef<(() => void) | null>(null);
  const cleanupSync = useRef<(() => void) | null>(null);

  // Initialise Android status bar style (icon colour + background) on startup.
  // Runs before auth hydration so it takes effect as early as possible.
  // Automatically updates when the user switches dark/light mode.
  useEffect(() => {
    void initStatusBar();
  }, []);

  // Start connectivity detection on mount so the offline banner works on the
  // login screen (when no session exists yet) and for anonymous users.
  // The service subscribes to OS network changes and periodically probes
  // Supabase reachability — see lib/connectivity/connectivityService.ts.
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    void initConnectivityService().then((fn) => {
      if (cancelled) {
        fn();
      } else {
        cleanup = fn;
      }
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // Handle deep links from email confirmation (custom URI scheme: com.pfennig50.app://auth/callback).
  // Supports both PKCE (?code=) and implicit (#access_token=) Supabase auth flows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect — captures stable module-level refs
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    initBackHandler();

    const handleDeepLinkUrl = async (url: string) => {
      try {
        const urlObj = new URL(url);

        // --- Invite deep link: com.arco.sharli://invite/{f|g}/{token} ---
        const isInviteLink = urlObj.pathname.match(/\/[fg]\/[A-Z0-9]{6}$/) !== null;

        if (isInviteLink) {
          const session = useAuthStore.getState().session;
          if (session) {
            await dispatchInviteToken(url, queryClient);
          } else {
            // Not logged in — store for processing after login.
            // parseInviteToken reads the type, route to correct store.
            const parsed = parseInviteToken(url);
            if (parsed?.type === 'friend') {
              usePendingInviteStore.getState().setToken(parsed.token);
            } else if (parsed?.type === 'group') {
              usePendingGroupInviteStore.getState().setToken(parsed.token);
            }
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

      // Start realtime + sync service as soon as a session is available.
      // Guard with null-check so TOKEN_REFRESHED events don't re-subscribe.
      // Connectivity detection is started separately at app mount so the
      // offline banner works on the login screen too.
      if (session && cleanupRealtime.current === null) {
        cleanupRealtime.current = subscribeRealtime(queryClient);
        void initSyncService(queryClient).then((cleanup) => {
          cleanupSync.current = cleanup;
        });
      }

      if (event === 'SIGNED_OUT') {
        // Stop realtime subscriptions and lifecycle listeners.
        cleanupRealtime.current?.();
        cleanupRealtime.current = null;
        cleanupSync.current?.();
        cleanupSync.current = null;

        // Remove this device's push token so the user stops receiving
        // notifications after signing out.
        if (currentPushToken.current) {
          void deletePushToken(currentPushToken.current);
          currentPushToken.current = null;
        }
        // Wipe the in-memory cache, the IndexedDB snapshot, and the offline
        // mutation queue so the next user never sees stale data — or has
        // their mutations replayed — from the previous session.
        queryClient.clear();
        idbPersister.removeClient();
        void clearOfflineQueue();
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
      } else if (data.type === 'settlement') {
        if (data.groupId) {
          void router.navigate({ to: '/groups/$groupId', params: { groupId: data.groupId } });
        } else if (data.friendId) {
          void router.navigate({ to: '/friends/$friendId', params: { friendId: data.friendId } });
        }
      }
    };

    let cleanup = () => {};
    initPushNotifications(handleToken, handleTap).then((fn) => {
      cleanup = fn;
    });

    return () => cleanup();
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Process pending invite tokens after auth hydration.
  // Two sources: (1) pending stores (from deep links before login),
  //              (2) Play Store install referrer (deferred deep link).
  useEffect(() => {
    if (!isHydrated) return;
    const session = useAuthStore.getState().session;
    if (!session) return;

    // 1. Check pending friend invite store
    const pendingFriendToken = usePendingInviteStore.getState().token;
    if (pendingFriendToken) {
      usePendingInviteStore.getState().clear();
      void processFriendInviteToken(pendingFriendToken, queryClient);
      return;
    }

    // 2. Check pending group invite store
    const pendingGroupToken = usePendingGroupInviteStore.getState().token;
    if (pendingGroupToken) {
      usePendingGroupInviteStore.getState().clear();
      void processGroupInviteToken(pendingGroupToken, queryClient);
      return;
    }

    // 3. Check Play Store install referrer (deferred deep link after install)
    // checkInstallReferrer() returns a prefixed token: 'f:TOKEN' or 'g:TOKEN'
    void checkInstallReferrer().then((referrerToken) => {
      if (referrerToken) void dispatchInviteToken(referrerToken, queryClient);
    });
  }, [isHydrated, queryClient]);

  return isHydrated ? (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: idbPersister, maxAge: CACHE_MAX_AGE }}
      >
        <RouterProvider router={router} context={{ queryClient }} />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  ) : (
    <div className="h-full w-full bg-background" />
  );
}
