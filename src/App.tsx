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
 *   - Starting the sync service (lib/storage/syncService.ts)
 *   - Nothing else — keep this file thin
 */

import { useState, useEffect } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';

import { router }                    from './router';
import { idbPersister, CACHE_MAX_AGE } from './lib/storage/queryPersister';
import { supabase }                  from './lib/supabase/client';
import { useAuthStore }              from './features/auth/authStore';

export default function App() {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 min — fresh data, background refetch after
          gcTime:    CACHE_MAX_AGE,
        },
      },
    }),
  );

  const { setSession, setHydrated, isHydrated } = useAuthStore();

  // Subscribe to Supabase auth changes. The first callback fires on mount
  // (even when offline) and tells us whether a session exists — that's when
  // we set isHydrated so the router can start running its guards.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setHydrated();
      },
    );
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't mount the router until we know the auth state.
  // This prevents a flash to /login when a session is already stored.
  if (!isHydrated) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">Laden…</span>
      </div>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister, maxAge: CACHE_MAX_AGE }}
    >
      <RouterProvider router={router} context={{ queryClient }} />
    </PersistQueryClientProvider>
  );
}
