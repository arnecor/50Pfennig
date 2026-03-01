# Architecture Details

## Money
- All monetary values are `Money` (integer cents, branded type). €12.50 = `money(1250)`.
- Never use raw `number` where `Money` is expected.
- Use `allocate(total, ratios)` for any split calculation — largest-remainder method.
- Percentages as **basis points** (0–10000). 33.33% = `3333`.
- Display: always use `formatMoney(m)`.

## Balances
- **Balances are never stored in the database.**
- Derived in the client from TanStack Query cached data using `calculateGroupBalances()`.

## Expense writes
- Creating/updating expense calls `supabase.rpc('create_expense', {...})` — atomic.
- RPC inserts `expenses` + `expense_splits` in one transaction.
- `expense_splits` rows are immutable financial history.

**RPC signatures** (call through repository):
```typescript
supabase.rpc('create_expense', {
  p_group_id:    GroupId,
  p_description: string,
  p_total_amount: number,  // cents
  p_paid_by:     UserId,
  p_split_type:  'equal' | 'exact' | 'percentage',
  p_split_config: Json,
  p_splits: { user_id: string; amount: number }[],
})
```

## Database Schema

All monetary columns are **integer cents**.

### `groups`, `group_members`, `expenses`, `expense_splits`, `settlements` — see full SQL in `supabase/migrations/0001_initial_schema.sql`

RLS enabled on all tables. Access gated on `is_group_member(group_id)`.

## Repositories
- Features call `IExpenseRepository`, etc. — never Supabase client directly.
- Offline mutation queue logic inside repository implementations.
