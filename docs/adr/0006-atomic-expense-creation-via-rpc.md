# ADR-0006: Atomic Expense Creation via Postgres RPC

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

Creating an expense requires writing to two tables simultaneously:
1. `expenses` — the expense header (description, total, who paid)
2. `expense_splits` — one row per participant (how much each person owes)

If the client makes two sequential API calls and the second fails (network drop, RLS violation, constraint error), the database is left in an inconsistent state: an expense exists with no splits. A balance calculation run at this moment would show incorrect results — the payer gets credited but no participants are debited.

## Decision

Expense creation (and updates) are performed via a **single Postgres function call** (`supabase.rpc('create_expense', {...})`). The function inserts both the expense row and all split rows inside one database transaction. If either insert fails, the entire transaction rolls back.

The function also validates:
- The caller is a member of the group (via `is_group_member()`)
- The sum of all split amounts equals the total expense amount

```sql
create or replace function public.create_expense(
  p_group_id uuid, p_description text, p_total_amount integer,
  p_paid_by uuid, p_split_type text, p_split_config jsonb,
  p_splits jsonb  -- [{user_id, amount}]
) returns public.expenses
language plpgsql security definer as $$ ... $$;
```

The same pattern applies to expense updates: the function deletes existing splits and inserts new ones within the same transaction.

## Consequences

- **Positive:** The database is always in a consistent state. There is no window between the expense insert and the splits insert where a balance calculation would return wrong results.
- **Positive:** Validation (membership check, sum check) runs inside the database where it cannot be bypassed by a client bug or a direct API call.
- **Positive:** Fewer network round trips — one RPC call instead of two sequential calls.
- **Negative:** Business logic (sum validation) is split between the domain layer (TypeScript, for the UI) and the database function (SQL, as a server-side guard). This duplication is intentional — the TypeScript layer provides fast UI feedback, the SQL layer enforces the invariant regardless of the client.
- **Negative:** Postgres functions require more care when changing: migrations must be tested, and the TypeScript types must be regenerated after changes.
