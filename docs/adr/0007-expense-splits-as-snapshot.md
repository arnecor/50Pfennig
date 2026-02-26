# ADR-0007: Store Expense Splits as a Computed Snapshot

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

When an expense is created, the split algorithm is run to compute how much each participant owes. There are two ways to store this in the database:

**Option A — Store only the split configuration, recompute on read:**
Store `split_type` and `split_config` (e.g. `{type: "equal"}`) and re-run the split algorithm whenever balances are needed.

**Option B — Store the computed snapshot:**
Run the split algorithm once at write time and store the result as rows in `expense_splits` (e.g. `alice: 1250, bob: 1250`).

## Decision

Use **Option B: store the computed snapshot** in `expense_splits`.

The `expense_splits` table records what each participant was agreed to owe at the time the expense was created. This is historical financial data — it should be immutable and independent of any future changes to the split algorithm.

The `split_config` column in `expenses` is also stored (as JSONB) for auditability — it records what rule produced the snapshot — but balance calculations always read from `expense_splits`, never re-derive from `split_config`.

## Consequences

- **Positive:** Balance calculation is a simple `SUM` over `expense_splits`. No domain logic needs to run on the database server.
- **Positive:** If the split algorithm is ever fixed (e.g. the rounding method changes), historical expenses are not retroactively altered. Financial history is immutable.
- **Positive:** The snapshot is auditable: each row shows exactly what a participant owed for a specific expense, with no need to re-run logic to understand it.
- **Negative:** An expense edit must delete all existing `expense_splits` rows and insert new ones. This is handled atomically inside the `create_expense` / `update_expense` Postgres functions (ADR-0006).
- **Negative:** The `split_config` and `expense_splits` can technically drift if the RPC function has a bug (the config says equal split but the stored amounts are not equal). This is guarded by the sum validation in the RPC function.
