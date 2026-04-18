/**
 * lib/storage/flushOfflineQueue.ts
 *
 * Replays queued mutations against Supabase in FIFO order when the device
 * is back online.
 *
 * Contract:
 *   - Process items in insertion order. If a retryable error occurs on an
 *     item, stop flushing (later items wait their turn). Permanent errors
 *     mark the item and we continue with the next — its temp-id stays in
 *     the queue for the user to retry or discard via the Pending Changes
 *     screen.
 *   - Temp-id reconciliation: when a CREATE_* succeeds we learn the server
 *     id. Any later queued mutation that references the client temp id
 *     gets rewritten in-place in the queue (e.g. expense created in a
 *     group that was also created offline).
 *   - Skip items that are already permanentlyFailed — those require user
 *     action.
 *   - Invalidate relevant TanStack Query caches after each successful
 *     mutation so the UI picks up the server snapshot.
 *
 * See ADR-0004 and the Offline Mode concept for the design rationale.
 */

import type { QueryClient } from '@tanstack/react-query';

import { supabase } from '@lib/supabase/client';

import {
  type ErrorKind,
  type QueuedMutation,
  isPermanentlyFailed,
  useOfflineQueue,
} from './offlineQueue';

type FlushOutcome = {
  succeeded: number;
  permanentlyFailed: number;
  deferred: number;
};

/**
 * Classifies a thrown Supabase / RPC error as 'retryable' (transient
 * network / 5xx / timeout) or 'permanent' (4xx, auth, validation, 404).
 *
 * The classification is intentionally conservative — unknown errors are
 * treated as retryable so a transient hiccup can't permanently lose a
 * user's write. Known 4xx-family codes flip to permanent so they surface
 * fast in Pending Changes instead of looping MAX_RETRIES times.
 */
function classifyError(err: unknown): ErrorKind {
  if (err instanceof Error) {
    // Supabase / PostgREST errors attach a numeric status + PG code.
    const withStatus = err as Error & { status?: number; code?: string };
    const status = withStatus.status;
    if (typeof status === 'number' && status >= 400 && status < 500) return 'permanent';

    const code = withStatus.code;
    // RLS denial, not-found, unique constraint etc. — no amount of retrying fixes these.
    if (code === '42501' || code === '23505' || code === '23514') return 'permanent';
    if (code === 'PGRST116') return 'permanent'; // no rows returned on a single()-select
  }
  return 'retryable';
}

/** Extracts a user-displayable message from any thrown value. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

/**
 * Rewrites references in *other* queued mutations that still carry a stale
 * temp id, so the next replay uses the server-assigned id.
 * Called after a CREATE_* succeeds and its own item has already been removed
 * from the queue via complete(). We must NOT rewrite the completed item's own
 * id here — it is already gone, and doing so caused an infinite replay loop
 * (the id change made complete()'s filter miss the item, leaving it in the
 * queue to be replayed on every subsequent flush trigger).
 */
function rewriteParentIds(tempId: string, serverId: string): void {
  const items = useOfflineQueue.getState().items;
  const updated = items.map((m) => {
    // CREATE_EXPENSE can reference a temp group id
    if (m.type === 'CREATE_EXPENSE' && m.payload.groupId === tempId) {
      return { ...m, payload: { ...m.payload, groupId: serverId } };
    }
    // UPDATE_EXPENSE / DELETE_EXPENSE reference an expense id that may itself
    // have been a temp id from an earlier CREATE_EXPENSE in the same queue.
    if (
      (m.type === 'UPDATE_EXPENSE' || m.type === 'DELETE_EXPENSE') &&
      m.payload.expenseId === tempId
    ) {
      return { ...m, payload: { ...m.payload, expenseId: serverId } };
    }
    return m;
  });
  // Direct state-write via setState to replace items in bulk — there's no
  // public action for "rewrite parent references".
  useOfflineQueue.setState({ items: updated });
}

// ---------------------------------------------------------------------------
// Per-type replay functions
// ---------------------------------------------------------------------------

async function replayCreateExpense(m: QueuedMutation): Promise<{ serverId: string }> {
  const p = m.payload as {
    groupId: string | null;
    description: string;
    totalAmount: number;
    paidBy: string;
    splitType: string;
    splitConfig: unknown;
    splits: unknown;
  };
  const { data, error } = await supabase.rpc('create_expense', {
    p_group_id: (p.groupId ?? null) as string,
    p_description: p.description,
    p_total_amount: p.totalAmount,
    p_paid_by: p.paidBy,
    p_split_type: p.splitType,
    p_split_config: p.splitConfig as never,
    p_splits: p.splits as never,
  });
  if (error) throw error;
  return { serverId: (data as { id: string }).id };
}

async function replayUpdateExpense(m: QueuedMutation): Promise<void> {
  const p = m.payload as {
    expenseId: string;
    description: string;
    totalAmount: number;
    paidBy: string;
    splitType: string;
    splitConfig: unknown;
    splits: unknown;
  };
  const { error } = await supabase.rpc('update_expense', {
    p_expense_id: p.expenseId,
    p_description: p.description,
    p_total_amount: p.totalAmount,
    p_paid_by: p.paidBy,
    p_split_type: p.splitType,
    p_split_config: p.splitConfig as never,
    p_splits: p.splits as never,
  });
  if (error) throw error;
}

async function replayDeleteExpense(m: QueuedMutation): Promise<void> {
  const p = m.payload as { expenseId: string };
  const { error } = await supabase.from('expenses').delete().eq('id', p.expenseId);
  if (error) throw error;
}

async function replayCreateGroup(m: QueuedMutation): Promise<{ serverId: string }> {
  const p = m.payload as { name: string; memberIds: string[] };
  // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types
  const { data, error } = await (supabase.rpc as any)('create_group', {
    p_name: p.name,
    p_member_ids: p.memberIds ?? [],
  });
  if (error) throw error;
  return { serverId: (data as { id: string }).id };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Flushes the offline mutation queue. Returns a summary of what happened so
 * the caller (syncService) can surface the "Synced N changes" toast.
 *
 * Safe to call concurrently — a module-level boolean prevents re-entry.
 */
let inFlight = false;

export async function flushOfflineQueue(queryClient: QueryClient): Promise<FlushOutcome> {
  if (inFlight) return { succeeded: 0, permanentlyFailed: 0, deferred: 0 };
  inFlight = true;

  const outcome: FlushOutcome = { succeeded: 0, permanentlyFailed: 0, deferred: 0 };

  try {
    // Snapshot the queue at entry — new items enqueued mid-flush will be
    // picked up on the next reconnect / manual trigger.
    const snapshot = useOfflineQueue.getState().items.slice();

    for (const m of snapshot) {
      if (isPermanentlyFailed(m)) {
        outcome.permanentlyFailed += 1;
        continue; // user must Retry or Discard on Pending Changes
      }

      try {
        let serverId: string | null = null;
        switch (m.type) {
          case 'CREATE_EXPENSE': {
            const r = await replayCreateExpense(m);
            serverId = r.serverId;
            break;
          }
          case 'UPDATE_EXPENSE': {
            await replayUpdateExpense(m);
            break;
          }
          case 'DELETE_EXPENSE': {
            await replayDeleteExpense(m);
            break;
          }
          case 'CREATE_GROUP': {
            const r = await replayCreateGroup(m);
            serverId = r.serverId;
            break;
          }
        }

        // Remove the item first (while its id still matches tempId), then
        // rewrite references in any remaining items. Reversed order prevents
        // the completed item from surviving the filter when its own id gets
        // rewritten from tempId → serverId by rewriteParentIds.
        useOfflineQueue.getState().complete(m.id);
        if (serverId) rewriteParentIds(m.id, serverId);
        outcome.succeeded += 1;
      } catch (err) {
        const kind = classifyError(err);
        useOfflineQueue.getState().recordFailure(m.id, errorMessage(err), kind);
        if (kind === 'retryable') {
          // Stop flushing — preserves FIFO so dependent ops don't run before
          // their parent succeeds. Remaining items stay in the queue for the
          // next reconnect.
          outcome.deferred += 1;
          break;
        }
        outcome.permanentlyFailed += 1;
        // Permanent error: continue with next item — this one is stuck on
        // the Pending Changes screen.
      }
    }

    if (outcome.succeeded > 0) {
      // Broad invalidation — cheap, and guarantees any list/detail view
      // rooted in 'expenses' / 'groups' / 'balances' catches up after
      // replay. Narrow targeting is an optimisation for later.
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      await queryClient.invalidateQueries({ queryKey: ['balances'] });
      await queryClient.invalidateQueries({ queryKey: ['settlements'] });
    }
  } finally {
    inFlight = false;
  }

  return outcome;
}
