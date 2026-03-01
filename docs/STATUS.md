# Implementation Status

## Page / component stubs (return null — need implementing)
- `src/pages/SettlementsPage.tsx`
- `src/pages/BalancesPage.tsx`
- `src/pages/AccountPage.tsx` *(partially — display name editing done, rest stubbed)*

## Infrastructure stubs (not wired up yet)
- `src/lib/storage/offlineQueue.ts`
- `src/lib/storage/syncService.ts`
- `src/features/balances/hooks/useGroupBalances.ts`

## Fully implemented — do not treat as stubs
Domain layer, repository implementations, database schema, RLS, RPC functions,
auth (login/signup/session), routing + guards, Zustand stores,
all of `src/components/shared/`, all of `src/components/ui/`,
groups feature (list, detail, card), expenses feature (form, list, mutation hooks),
query option factories (`expenseQueries.ts`, `groupQueries.ts`).
