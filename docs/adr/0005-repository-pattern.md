# ADR-0005: Repository Pattern for Data Access

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

Feature components and hooks need to read and write data (expenses, groups, settlements). They could call Supabase directly, or go through an abstraction layer.

If features call Supabase directly:
- Switching the sync mechanism (e.g. Supabase → PowerSync) requires changing every feature hook
- Testing features requires mocking the Supabase client
- The offline mutation queue logic would be duplicated across hooks

## Decision

All data access goes through typed **repository interfaces** defined in `src/repositories/types.ts`. Supabase implementations live in `src/repositories/supabase/`. Features only import from `src/repositories/` — never from `src/lib/supabase/` directly.

```typescript
// src/repositories/types.ts
export interface IExpenseRepository {
  getByGroupId(groupId: GroupId): Promise<Expense[]>;
  create(input: CreateExpenseInput): Promise<Expense>;
  update(id: ExpenseId, input: UpdateExpenseInput): Promise<Expense>;
  delete(id: ExpenseId): Promise<void>;
}
```

The concrete binding is done in `src/repositories/index.ts` (a simple factory, no DI framework needed). Offline queue logic is handled inside the repository implementations, not in feature hooks.

## Consequences

- **Positive:** Switching the sync backend (e.g. to PowerSync) requires only a new implementation class and a one-line change in `index.ts`. All feature hooks are untouched.
- **Positive:** Repository implementations are the single place where the offline queue is engaged. Feature hooks do not need to know about connectivity state.
- **Positive:** Testing feature hooks can be done with a simple in-memory mock repository — no Supabase client needed.
- **Negative:** One more layer of indirection to navigate when reading code. Acceptable given the long-term payoff.
