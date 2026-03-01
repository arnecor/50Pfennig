# Implementation Status

## Page / component stubs (return null — need implementing)
- `src/pages/SettlementsPage.tsx`
- `src/pages/FriendsPage.tsx` *(placeholder — shows empty state, friend-adding UI not yet implemented)*
- `src/pages/AccountPage.tsx` *(partially — display name editing done, rest stubbed)*

## Infrastructure stubs (not wired up yet)
- `src/lib/storage/offlineQueue.ts`
- `src/lib/storage/syncService.ts`
- `src/features/balances/hooks/useGroupBalances.ts`

## Fully implemented — do not treat as stubs
Domain layer, repository implementations, database schema, RLS, RPC functions,
auth (login/signup/session), routing + guards, Zustand stores,
all of `src/components/shared/`, all of `src/components/ui/`,
groups feature (list, detail, card),
expenses feature (form with ParticipantPicker overlay, list, mutation hooks),
friends feature (repository + useFriends hook — UI for adding friends is stubbed),
balances (useTotalBalance — cross-group + cross-friend),
query option factories (`expenseQueries.ts`, `groupQueries.ts`, `settlementQueries.ts`).
