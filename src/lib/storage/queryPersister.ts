/**
 * lib/storage/queryPersister.ts
 *
 * TanStack Query cache persister backed by IndexedDB (via idb-keyval).
 *
 * This makes the query cache survive app restarts. When the app opens
 * while offline, all queries immediately return the last cached data
 * (up to 7 days old) instead of showing loading states or errors.
 *
 * The persister is passed to <PersistQueryClientProvider> in App.tsx.
 *
 * Cache TTL: 7 days. Stale data is shown immediately while a background
 * refetch runs when connectivity is available (stale-while-revalidate).
 *
 * Imported by: src/App.tsx (provider setup)
 */

import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export const idbPersister: Persister = {
  persistClient: (client: PersistedClient) => set('50pfennig-tq-cache', client),
  restoreClient: () => get<PersistedClient>('50pfennig-tq-cache'),
  removeClient:  () => del('50pfennig-tq-cache'),
};
