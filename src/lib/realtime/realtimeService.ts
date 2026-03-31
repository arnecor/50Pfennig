/**
 * lib/realtime/realtimeService.ts
 *
 * Manages a single Supabase Realtime channel that watches all tables whose
 * changes need to be reflected in the UI for other users.
 *
 * On any postgres_changes event the service calls queryClient.invalidateQueries()
 * with the root-level query key for the affected domain. TanStack Query then
 * triggers a background refetch for every currently-mounted component that
 * depends on that data.
 *
 * Lifecycle:
 *   - Call subscribeRealtime(queryClient) once after the user signs in.
 *   - Call the returned cleanup function on sign-out.
 *   - The Supabase client handles WebSocket reconnects automatically.
 *
 * Table → query key mapping:
 *   expenses        → ['expenses']
 *   expense_splits  → ['expenses']   (balances are derived from splits)
 *   settlements     → ['settlements']
 *   friendships     → ['friends']
 *   group_members   → ['groups']
 *   group_events    → ['groups']
 *
 * Note: root-level keys (e.g. ['expenses']) invalidate all sub-keys safely
 * without needing to inspect the event payload for a group_id or user_id.
 * RLS ensures users only receive events for rows they are authorised to read.
 *
 * Performance notes: docs/realtime-sync.md
 */

import { supabase } from '@lib/supabase/client';
import type { QueryClient } from '@tanstack/react-query';

const CHANNEL_NAME = 'app-realtime-sync';

/**
 * Subscribes to postgres_changes for all synced tables.
 * Returns a cleanup function that removes the channel.
 */
export function subscribeRealtime(queryClient: QueryClient): () => void {
  const channel = supabase
    .channel(CHANNEL_NAME)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_events' }, () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
