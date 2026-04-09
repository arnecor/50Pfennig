# Implementation Status

Last updated: 2026-04-09

## Feature Status

| Feature                       | Status       | Notes                                                              |
|------------------------------|--------------|--------------------------------------------------------------------|
| Expense CRUD                 | Complete     |                                                                    |
| Group management             | Complete     |                                                                    |
| Friend-adding UI             | Complete     | EmailSearch, QRCode scanner, AddFriendMethodList                   |
| Balance calculation (domain) | Complete     | Unit + property-based tests passing                                |
| Balance UI (group view)      | Complete     | `src/pages/BalancesPage.tsx` — debt instructions + settle CTA      |
| Per-friend balance UI        | Complete     | FriendsPage shows per-friend balance (group + direct combined)     |
| Settlement (group)           | Complete     | RecordGroupSettlementSheet, batch via useCreateSettlement          |
| Settlement batch (ADR-0012)  | Proposed     | ADR-0012 not yet accepted; no implementation                       |
| Offline sync (ADR-0004)      | Not started  | `offlineQueue.ts` is a TODO stub — do not use in feature code      |
| Android build optimizations  | Proposed     | See `docs/android-build-optimization.md`                           |
| Push notifications           | Complete     | Edge function `send-push`, webhooks configured per `docs/commands.md` |

## Known Stubs / Dead Code

- `src/store/offlineStore.ts` — re-exports nothing; implementation lives in
  `src/lib/storage/offlineQueue.ts` which is also a TODO stub.

## Planned Refactors

These are tracked here so they don't get forgotten, but are not blocking anything:

- **Supabase RPC type audit**: Several repository functions cast nullable RPC params due to
  generated type gaps (e.g. `expenseRepository.ts:81`). Audit after next type regeneration.
