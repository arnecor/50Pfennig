# ADR-0004: Offline-First via TanStack Query Cache Persistence + Zustand Mutation Queue

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

The app runs on Android (Capacitor). Users may be on flights, in areas with poor connectivity, or in airplane mode when they want to log an expense. Blocking all writes when offline would be a significant UX failure for a mobile app.

True offline-first requires:
1. Reads that return data when offline (no network call)
2. Writes that are accepted offline and synced when connectivity returns
3. Persistence that survives app restarts while offline

Options considered:
- **TanStack Query cache persistence + Zustand mutation queue** — uses tools already in the stack; practical offline-first for this use case
- **PowerSync** — purpose-built offline sync layer for Supabase/Postgres; creates a local SQLite replica; more complex setup and a new service to manage
- **Capacitor SQLite + custom sync** — local SQLite as source of truth with manual push/pull; most control, most work

## Decision

Use **TanStack Query `experimental_createPersister`** (backed by IndexedDB via `idb-keyval`) for offline reads, and a **Zustand-persisted mutation queue** for offline writes.

How it works:
1. All TanStack Query caches are persisted to IndexedDB on every write. On app restart while offline, queries immediately return the last cached data (7-day TTL).
2. When a mutation is attempted offline, an optimistic update is applied to the TQ cache (immediate UI feedback) and the mutation is pushed to the `offlineMutationQueue` (Zustand store, persisted to IndexedDB).
3. `syncService.ts` listens to `@capacitor/network` and `@capacitor/app` events. On connectivity restore, the queue is flushed in order. Stops on first failure to preserve causal ordering. Retries are capped at 5; after that, the mutation is surfaced to the user as a conflict.
4. After a successful flush, affected TanStack Query keys are invalidated to refetch authoritative server state.

## Consequences

- **Positive:** No new services or infrastructure to manage. All tools are already part of the planned stack.
- **Positive:** Covers the 99% case: logging expenses and settlements while temporarily offline.
- **Positive:** The repository abstraction (ADR-0005) means this can be replaced with PowerSync by implementing new repository classes. Feature code is untouched.
- **Negative:** Not a true conflict-free sync (unlike CRDTs or PowerSync). If user A deletes a group while user B is offline and queues an expense for that group, the flush will fail. This is acceptable for V1 given the trust-based, small-group context where such concurrent destructive conflicts are rare.
- **Negative:** Queue ordering means a single failed mutation blocks all subsequent mutations for the same group. This is intentional to preserve causal consistency (you cannot settle an expense that hasn't synced yet).
- **Known limitation:** If the app process is killed while a write is in-flight (not yet in the queue), that write is lost. Mutations must be enqueued before the async network call, not after.
