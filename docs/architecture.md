# Architecture Details

## Money
- All monetary values are `Money` (integer cents, branded type). €12.50 = `money(1250)`.
- Never use raw `number` where `Money` is expected.
- Use `allocate(total, ratios)` for any split calculation — largest-remainder method.
- Percentages as **basis points** (0–10000). 33.33% = `3333`.
- Display: always use `formatMoney(m)`.

## Balances
- **Balances are never stored in the database.**
- Group expenses: derived from `calculateGroupBalances(expenses, settlements, members)`.
- Friend expenses: derived from `calculateParticipantBalances(expenses)` — no member list needed, participants come from splits.
- Both functions are in `src/domain/balance/index.ts`.

## Expense context: group vs. friend
- `expenses.group_id` is **nullable**. `NULL` = friend expense (not in a group).
- Group expense: split among group members; `group_id` is set.
- Friend expense: split among selected friends + payer; `group_id` is null.
- No mixing — an expense is either in a group OR between friends, never both.
- Participants are always derived from `expense_splits` — the `expense.groupId` is only for organisational context.

## Expense writes
- Creating/updating expense calls `supabase.rpc('create_expense', {...})` — atomic.
- RPC inserts `expenses` + `expense_splits` in one transaction.
- `expense_splits` rows are immutable financial history.

**RPC signature** (call through repository):
```typescript
supabase.rpc('create_expense', {
  p_group_id:     GroupId | null,  // null for friend expenses
  p_description:  string,
  p_total_amount: number,          // cents
  p_paid_by:      UserId,
  p_split_type:   'equal' | 'exact' | 'percentage',
  p_split_config: Json,
  p_splits:       { user_id: string; amount: number }[],
})
```

## Database Schema

All monetary columns are **integer cents**.

### Tables
- `groups`, `group_members` — unchanged
- `group_events` — extensible event log for group lifecycle (member_joined, member_left). `event_type` is unconstrained text; `metadata` is jsonb for future payloads. New events are written atomically via RPC alongside the membership change.
- `expenses` — `group_id` is now **nullable** (NULL = friend expense)
- `expense_splits` — unchanged (source of truth for all balances)
- `settlements` — `group_id` is now **nullable** (NULL = friend settlement)
- `friendships` — one row per pair, unordered unique index

```sql
-- friendships
id           uuid PK
requester_id uuid FK → profiles.id
addressee_id uuid FK → profiles.id
status       text  -- 'pending' | 'accepted'
created_at   timestamptz

-- Unordered unique index prevents duplicate (A,B) and (B,A) rows
```

RLS enabled on all tables. `expenses` access: group member (group expense) OR direct participant (friend expense).

## Friendships
- One row per pair. Canonical storage: `(least(a,b), greatest(a,b))` enforced by unique index.
- `requester_id` / `addressee_id` preserved for future invite flows (email, QR, phone).
- `status = 'accepted'` for manually seeded friendships.
- Adding friends via UI is **not yet implemented** — use seed script for dev data.

## Group Settings & Member Lifecycle
- `GroupSettingsPage` at `/groups/$groupId/settings` — member list with per-member balances, share placeholders, leave-group action.
- **Leave group**: calls `leave_group` RPC (atomic: removes `group_members` row + inserts `member_left` event).
- **Add member**: calls `add_member_with_event` RPC (atomic: inserts `group_members` row + inserts `member_joined` event).
- **Rejoin**: allowed — leaving deletes the `group_members` row; re-adding creates a new row. Both events remain in `group_events`.
- GroupDetailPage activity feed merges expenses + settlements + group_events (sorted by `createdAt`).

## Repositories
- Features call `IExpenseRepository`, `IFriendRepository`, etc. — never Supabase client directly.
- `friendRepository` is exported from `repositories/index.ts`.
