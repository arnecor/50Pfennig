# ADR-0009: Balances Are Never Stored — Always Derived

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

The net balance for a user in a group (how much they are owed or owe in total) could be:

**Option A — Stored as a column:** Maintained as a running total in a `balances` table, updated on every expense or settlement write.

**Option B — Derived on read:** Computed from the full expense and settlement history each time it is needed.

## Decision

Balances are **never stored**. They are always computed from `expense_splits` and `settlements` at read time, in the client, from the TanStack Query cache.

```typescript
// Pure derivation — no database query needed beyond the already-cached data
const balances = calculateGroupBalances(expenses, settlements, members);
```

## Consequences

- **Positive:** There is exactly one source of truth: the expense and settlement records. A stored balance could drift from reality if any write fails partially. With derived balances, the balance is always mathematically consistent with the history.
- **Positive:** Balance is computed instantly from already-cached data — no additional network request, works offline.
- **Positive:** Historical balance at any point in time can be derived by filtering expenses/settlements to a date range. A stored balance column cannot provide this without additional history tables.
- **Positive:** The algorithm is in pure TypeScript (`src/domain/balance/`), fully unit tested, easy to audit.
- **Negative:** For very large groups with thousands of expenses, re-deriving balances on every render could become slow. For the V1 target (2–10 people, typical group lifetime measured in months), this is not a concern. If it becomes one, a memoized selector over the TanStack Query cache is the solution — not a stored balance column.
- **Negative:** "What is the current balance?" requires fetching all expenses and settlements for the group. This is already required for other views (expense list, settlement list), so no extra fetch is needed in practice.
