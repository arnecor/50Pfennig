# Realtime Sync — Performance Notes & Monitoring Guide

## Overview

Data freshness is achieved through two complementary layers:

| Layer | Mechanism | Triggers |
|---|---|---|
| **Push** | Supabase Realtime `postgres_changes` | Any DB write by any user |
| **Pull** | Capacitor app-resume + network-reconnect | App foreground / connectivity restored |

Both layers call `queryClient.invalidateQueries()`, which bypasses `staleTime` and triggers a background refetch for every currently-mounted query observer.

---

## Known Side Effects

### 1. Redundant refetch on own mutations

**What happens:** When the local user creates an expense, two invalidations occur:
1. The mutation's own `onSuccess` → `invalidateQueries({ queryKey: ['expenses'] })`
2. Milliseconds later, the Realtime channel receives the INSERT event → same invalidation

TanStack Query deduplicates in-flight requests, so in practice only one network call goes out. But the query is marked stale twice, which causes a second background refetch shortly after the first.

**Impact:** Low — one extra REST call per own mutation. No visible UI effect.

**Possible improvement:** Debounce `invalidateQueries` calls per key with a 500 ms window, or track a "pending own mutations" set to skip realtime events that match a locally-initiated change.

---

### 2. Root-key invalidation is broad

**What happens:** The realtime service uses root-level query keys (e.g. `['expenses']`) to invalidate. This invalidates **all** sub-key variants: `['expenses', groupId]`, `['expenses', 'participant']`, `['expenses', 'detail', id]`, etc.

**Impact:** If the user is on a group detail page with multiple expense queries mounted, all of them refetch simultaneously when any expense changes anywhere. For a small app (2–10 users) this is negligible.

**Possible improvement:** Parse the Realtime event payload to extract `group_id` and only invalidate the specific `['expenses', groupId]` key. Requires the table to have `REPLICA IDENTITY FULL` set so the full row is included in the event.

---

### 3. Realtime channel gap on flaky networks

**What happens:** The Supabase WebSocket can silently disconnect on mobile (e.g. switching between WiFi and mobile data). The client auto-reconnects, but changes that occurred during the gap are not replayed.

**Impact:** The pull-based layer (app-resume, network-reconnect) covers this: when connectivity restores, `initSyncService` triggers a full `invalidateQueries()`. The gap is filled on the next foreground event.

**Possible improvement:** On Realtime channel reconnect, proactively call `invalidateQueries()` to flush the gap. The Supabase channel `.subscribe()` callback receives a `SUBSCRIBED` status that can be used as a trigger.

---

### 4. `staleTime: 30 s` increases REST call frequency

**What happens:** Reduced from 5 minutes to 30 seconds. Each component re-mount after 30 s will trigger a background refetch.

**Impact:** Slightly more REST traffic than before. For the app's scale this is acceptable and is significantly below Supabase free-tier REST limits (500k calls/month included).

**Possible improvement:** If REST traffic becomes a concern, increase `staleTime` back to 2–5 minutes and rely entirely on the realtime + app-resume invalidation. The realtime layer makes `staleTime` less critical — it is mainly a fallback now.

---

### 5. Supabase Free Tier Realtime Limits

| Limit | Free Tier | Notes |
|---|---|---|
| Concurrent connections | **200** | One WebSocket per authenticated app session |
| Messages per month | **2 million** | Each DB row change = 1 message per connected client |
| Max channels per client | 100 | We use 1 channel — well within limit |

**For Sharli:** 200 concurrent users would need to be active simultaneously to hit the connection limit. The message limit is ~66k messages/day — only reachable with very heavy write activity across many users.

---

## How to Monitor in Supabase

### Dashboard → Project → Reports

Open your project at [app.supabase.com](https://app.supabase.com) and navigate:

#### Realtime usage
**Sidebar → Reports → Realtime**
- **Active connections over time** — see peak concurrent connections vs. the 200 limit
- **Messages sent/received** — track monthly message volume vs. the 2M limit
- **Channel subscriptions** — how many channels are currently active

#### REST / PostgREST
**Sidebar → Reports → API**
- **Request count** — total REST calls (from TQ fetches after invalidation)
- **Error rate** — 4xx/5xx breakdown; watch for 429 (rate limit) responses
- **Latency** — p50/p95 response times for your queries

#### Database
**Sidebar → Reports → Database**
- **Query performance** — slow query log; useful if broad invalidation triggers expensive queries
- **Active connections** — Postgres connection pool usage (separate from Realtime WebSocket connections)

#### Billing / Usage
**Top-right avatar → Organization → Usage**
- **Realtime messages** — current month vs. quota (2M on free tier)
- **Database egress** — data transferred (free tier: 5 GB/month)
- **Storage** — if you later add file attachments

### Logs Explorer
**Sidebar → Logs → Edge Functions / PostgREST / Realtime**

The Realtime log stream shows:
- `SUBSCRIBED` / `UNSUBSCRIBED` events per client
- Channel join/leave
- Any errors in event delivery

Use this if you suspect a client is not receiving events.

### Alerts (Pro tier only)
The free tier does not support usage-based alerts. If you upgrade, you can set email alerts at 80% of the Realtime connection or message limit.

**Workaround on free tier:** Check the Usage dashboard manually once a month, or set a calendar reminder to review when your user base grows.

---

## Future Improvements (Backlog)

- [ ] Debounce realtime invalidations to suppress redundant own-mutation refetches
- [ ] Use `REPLICA IDENTITY FULL` + payload inspection for granular key invalidation
- [ ] On channel `SUBSCRIBED` (reconnect) event, call `invalidateQueries()` to fill gaps
- [ ] Add Realtime `status` monitoring to surface connection health in dev tools
- [ ] When offline queue is implemented: call `flush()` from `initSyncService` on network-reconnect, not just `invalidateQueries()`
