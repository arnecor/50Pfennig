# ADR-0011: Friends Entity and Flexible Expense Context

- **Date:** 2026-03-01
- **Status:** Accepted

## Context

The initial implementation only supported group expenses: every expense had to belong to a group. This was too rigid for the common case where two or three people share a cost outside any group context (e.g. splitting a taxi fare with a friend, paying for someone's dinner).

Two related problems needed solving:

1. **No friends concept** — the app had no way to represent a relationship between two users outside of a shared group.
2. **Expenses were always group-scoped** — `expenses.group_id` was NOT NULL, preventing friend-to-friend splits.

The design needed to stay simple: no mixing (an expense is either in a group OR between friends, never both), and no complex graph of per-pair balances visible in the UI at this stage.

## Decision

### 1. `friendships` table (new)

A new `friendships` table stores accepted relationships between users:

```sql
id           uuid PK
requester_id uuid FK → profiles.id
addressee_id uuid FK → profiles.id
status       text  -- 'pending' | 'accepted'
created_at   timestamptz
```

A functional unique index `(least(requester_id, addressee_id), greatest(requester_id, addressee_id))` prevents duplicate (A→B) and (B→A) rows while preserving `requester_id`/`addressee_id` for future invite flows (email, QR, phone).

### 2. `expenses.group_id` made nullable

`NULL` = friend expense. A set value = group expense. This is the sole discriminator — no separate type column needed.

The same change applies to `settlements.group_id` so friend-level settlements are possible in the future.

### 3. RLS updated for nullable `group_id`

Expense/split access was previously gated on group membership. With nullable `group_id`, policies now apply OR logic:

- Group expense: caller must be a group member (`is_group_member(group_id)`).
- Friend expense: caller must be the payer OR a participant in `expense_splits`.

### 4. `create_expense` RPC accepts nullable `p_group_id`

The RPC signature changed from `p_group_id uuid` to `p_group_id uuid` (nullable). The membership validation is skipped when `p_group_id` is null.

### 5. `calculateParticipantBalances` domain function (new)

A new pure function derives balances from friend expenses without needing a member list — participants are read directly from `expense_splits`. This mirrors `calculateGroupBalances` which requires the group's member list.

### 6. UI: "Teilen mit" participant picker

The "Ausgabe hinzufügen" button no longer opens a group dropdown. Instead, the expense form contains a "Teilen mit" field that opens a full-screen overlay:

- **Groups section**: tap to select (single-select). Tapping the selected group deselects it.
- **Friends section**: checkboxes (multi-select).
- Selecting a group clears friend selection and vice versa (mutual exclusion).
- Search bar filters both sections.

### 7. Navigation

- Removed the standalone **Balances** tab (balance summary moved to Home screen).
- Added **Friends** tab (placeholder — friend-adding UI not yet implemented).
- Single `/expenses/new` route replaces the old group-scoped `/groups/$groupId/expenses/new`.
- Optional `?groupId` search param pre-selects the group in the picker when navigating from a group detail page.

## Consequences

- **Positive:** Expenses can now be split between any combination of friends, not just group members.
- **Positive:** The `friendships` table is future-ready for pending invites without a schema change.
- **Positive:** A single expense route simplifies navigation and removes the group-context dependency.
- **Positive:** `useTotalBalance` on the Home screen now aggregates both group and friend balances in one place.
- **Negative:** No mixing (group + friends in one expense) is enforced by convention in the UI, not the database. A future requirement for mixed expenses would require a schema change.
- **Negative:** Friend-adding via the UI is not yet implemented — seed script must be used in development. This is a known gap to address in a future issue.
- **Neutral:** `expense_splits` remains unchanged and is still the single source of truth for all balance calculations.
