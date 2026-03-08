# ADR-0012: Settlement Allocation Across Contexts

- **Date:** 2026-03-08
- **Status:** Proposed

## Context

A user can owe another user money from multiple contexts simultaneously:

- Group X: Anna owes me €15 (from a shared dinner expense)
- Direct: Anna owes me €5 (from a taxi split)
- Total: Anna owes me €20

When Anna pays me back €20, this single real-world payment must correctly update **every** balance view:

- GroupDetailPage (Group X): Anna's balance goes from −€15 to €0
- FriendDetailPage (Anna): net balance goes from −€20 to €0
- HomePage total balance: updates by €20
- FriendsPage list: Anna's balance goes to "balanced"

### Problem with the current design

`settlements.group_id` scopes each settlement record to exactly one context. A €20 settlement can either:

- Be stored with `group_id = X` → group balance updates, but friend/direct balance stays at −€5
- Be stored with `group_id = NULL` → direct balance updates, but group balance stays at −€15

There is no way for a single settlement record to affect multiple contexts. The balances will always be wrong in at least one view.

### Why "just derive the allocation" doesn't work

An alternative would be to store settlements without any `group_id` and derive the per-context allocation at read time (proportional to each context's share of the total debt). However, this violates the immutability principle established in ADR-0007: if a new expense is added after a settlement, the allocation of past settlements would shift retroactively. A settlement recorded to pay off group debt should not be partially re-attributed to a later direct expense.

## Decision

### 1. Settlement batches

A single real-world payment creates **multiple settlement records** — one per context — linked by a shared `batch_id`. The allocation is computed at creation time and stored immutably.

```
settlements table (modified):
  + batch_id  UUID  nullable  -- links records from one real-world payment
```

Example: Anna pays me €20 (€15 from Group X, €5 direct):

| id | batch_id | group_id | from | to | amount |
|----|----------|----------|------|----|--------|
| a1 | b1       | group-X  | Anna | me | 1500   |
| a2 | b1       | NULL     | Anna | me | 500    |

Records with the same `batch_id` represent one real-world payment and share the same `note` and `created_at`.

### 2. Allocation algorithm (pure domain function)

A new domain function `allocateSettlement()` computes how a payment is distributed across contexts:

```typescript
type ContextDebt = {
  groupId: GroupId | null;  // null = direct/friend context
  amount: Money;            // positive = they owe me, negative = I owe them
};

allocateSettlement(
  paymentAmount: Money,
  debtsPerContext: ContextDebt[],
): Map<GroupId | null, Money>
```

**Algorithm (greedy, same-direction first):**

1. Filter to contexts where the debt flows in the same direction as the payment (debtor → creditor).
2. Sort by amount descending (largest debt first).
3. Allocate greedily until the payment is exhausted.
4. If payment exceeds same-direction debts, allocate remainder to `group_id = NULL` (overpayment creates a credit on the direct balance).

**Full settlement shortcut:** When the payment amount equals the exact net debt, the system can zero out all contexts by creating settlements in both directions:

- Anna owes me €15 (Group X), I owe Anna €3 (Group Y). Net: €12.
- Anna pays me €12.
- Allocation: `{group_id: X, Anna→me, €15}` + `{group_id: Y, me→Anna, €3}`. Net cash = €15 − €3 = €12. ✓
- Both groups show balanced.

This full-settlement optimization is applied when `paymentAmount === sum(positive debts) - sum(negative debts)`.

### 3. Atomic creation via RPC

A new Postgres RPC `create_settlement_batch` ensures all records in a batch are written atomically:

```sql
create_settlement_batch(
  p_from_user_id  UUID,
  p_to_user_id    UUID,
  p_total_amount  INTEGER,
  p_note          TEXT,
  p_allocations   JSONB  -- [{group_id, amount}, ...]
)
```

Validations inside the RPC:
- `sum(allocations.amount)` must equal `p_total_amount` (for same-direction allocations) or the net must equal `p_total_amount` (for full-settlement with cross-direction)
- For each allocation with a non-null `group_id`: both users must be group members
- `from_user_id ≠ to_user_id`
- All amounts > 0

The RPC generates a single `batch_id` and inserts one row per allocation.

### 4. Batch deletion

When a user deletes a settlement, **all records in the same batch are deleted together**. This preserves consistency — you cannot delete the group portion of a payment while keeping the direct portion.

RLS policy: only the `from_user_id` of the batch can delete (same as current).

### 5. Display rules

- **FriendDetailPage**: queries all settlements between the two users (any `group_id`), groups by `batch_id` for display. Shows the total amount per batch as one line item.
- **GroupDetailPage / SettlementsPage**: queries settlements for the group only (`group_id = X`). Shows the allocated amount per settlement.
- **HomePage / useTotalBalance**: no change needed — already fetches per-group and per-friend settlements separately. Each context sees only its allocated portion.

### 6. Repository changes

```typescript
interface ISettlementRepository {
  // Existing (no change)
  getByGroupId(groupId: GroupId): Promise<Settlement[]>;
  getByParticipant(): Promise<Settlement[]>;

  // New
  getSharedWithUser(userId: UserId): Promise<Settlement[]>;  // all settlements between current user and userId, any group_id
  createBatch(input: CreateSettlementBatchInput): Promise<Settlement[]>;  // atomic via RPC
  deleteBatch(batchId: string): Promise<void>;  // deletes all records in batch

  // Deprecated — use createBatch instead
  create(input: CreateSettlementInput): Promise<Settlement>;
  delete(id: SettlementId): Promise<void>;
}
```

### 7. Domain type changes

```typescript
type Settlement = {
  readonly id: SettlementId;
  readonly batchId: string | null;      // NEW — links records from one payment
  readonly groupId: GroupId | null;
  readonly fromUserId: UserId;
  readonly toUserId: UserId;
  readonly amount: Money;
  readonly note?: string;
  readonly createdAt: Date;
};
```

## Consequences

- **Positive:** Balances are correct everywhere, always. A single payment updates all contexts atomically.
- **Positive:** Allocation is stored immutably at creation time — consistent with ADR-0007 (splits as snapshot). Adding new expenses later does not retroactively change past settlement allocations.
- **Positive:** The allocation algorithm is a pure domain function — fully testable, no database dependency.
- **Positive:** Backward compatible — existing settlement records (if any) simply have `batch_id = NULL` and behave as before.
- **Positive:** FriendDetailPage can show the full payment amount while GroupDetailPage shows only the relevant portion — both from the same underlying data.
- **Negative:** More complex than a simple INSERT — requires an RPC and client-side allocation computation. Justified by the correctness guarantee.
- **Negative:** Batch deletion is all-or-nothing. A user cannot selectively delete the group portion of a payment. This is intentional — partial deletion would create inconsistent balances.
- **Neutral:** The `group_id` column remains on the `settlements` table. It now represents "which context this portion of the payment is allocated to" rather than "which context this payment belongs to."
