# State Management Details

## TanStack Query keys
```
["groups"]                 → list of groups
["groups", groupId]        → single group with members
["expenses", groupId]      → all expenses for a group
["settlements", groupId]   → all settlements for a group
["currentUser"]            → authenticated user profile
```

- Use `queryKey` factory function in each feature's `*Queries.ts`.
- All mutations use `onMutate` / `onError` / `onSettled` for optimistic updates.
- Cache persisted to IndexedDB (7-day TTL).

## Zustand Stores

`authStore` (`src/features/auth/authStore.ts`):
```typescript
session:     Session | null
isHydrated:  boolean
setSession:  (s: Session | null) => void
```

`uiStore` (`src/store/uiStore.ts`):
```typescript
selectedGroupId:    GroupId | null
activeSheet:        'add-expense' | ... | null
```

`offlineStore`: mutation queue — **not yet implemented**. Do not reference or enqueue mutations in feature code until this is built.
