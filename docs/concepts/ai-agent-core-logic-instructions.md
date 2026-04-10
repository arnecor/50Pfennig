# AI Agent Instructions for Core Business Logic (Token-Efficient)

This document is a **proposed instruction block** you can give to AI coding agents (especially Codex) so they quickly understand the core financial logic and where to change code safely.

## Copy/paste instruction block for agents

```md
You are working on 50Pfennig. Before coding, load only the minimum files below and keep edits inside established layers.

## Mission-critical invariants (must never break)
1. `sum(expense_splits.amount) === expenses.total_amount` for each expense.
2. Percentage split basis points sum to 10000.
3. Balances are never persisted; always derived from expenses + settlements.
4. Expense writes must stay atomic via RPC (`create_expense` / `update_expense`), never dual client inserts.
5. `expenses.group_id` and `settlements.group_id` are nullable:
   - non-null = group context
   - null = friend context
   Never mix contexts within one expense.
6. `expense_splits` is the immutable financial snapshot stored at write-time.

## First-read map (in this exact order)
1. `docs/architecture.md` (money model, context model, write-path overview).
2. `src/domain/splitting/index.ts` (split algorithm and validations).
3. `src/domain/balance/index.ts` (net balance derivation + debt simplification).
4. `src/repositories/supabase/expenseRepository.ts` (RPC write path + split snapshot generation).
5. `src/repositories/supabase/settlementRepository.ts` (single vs batch settlement writes).
6. `supabase/migrations/0001_initial_schema.sql` (base schema, RLS model, create/update expense RPC).
7. `supabase/migrations/0003_friends_and_flexible_expenses.sql` (friend context, nullable group_id).
8. `supabase/migrations/0004_fix_rls_recursion.sql` (SECURITY DEFINER helper for safe RLS policy evaluation).
9. `supabase/migrations/0013_create_group_rpc.sql` (atomic group creation).
10. `supabase/migrations/0014_friend_invites.sql` (friend add flows via RPC).
11. `supabase/migrations/0015_settlement_batches.sql` (multi-context settlement atomic batching).

## Where to edit for common tasks
- Split math rules: `src/domain/splitting/index.ts` (+ tests in `src/domain/splitting/splitting.test.ts`).
- Balance/debt logic: `src/domain/balance/index.ts` (+ tests in `src/domain/balance/balance.test.ts`).
- Expense write/read behavior: `src/repositories/supabase/expenseRepository.ts` and DB RPC migrations.
- Settlement behavior: `src/repositories/supabase/settlementRepository.ts` and `0015_settlement_batches.sql`.
- Friend lifecycle logic: `src/repositories/supabase/friendRepository.ts` and `0014_friend_invites.sql`.
- Access bugs (permissions/visibility): inspect relevant RLS policies in migrations before touching UI.

## Required workflow before making logic changes
1. Identify target invariant(s) affected.
2. Trace full path: domain function → repository call → SQL RPC/policy.
3. If persistence logic changes, update SQL migration and repository call together.
4. Add/update domain tests first (or in same change) for edge cases and zero-sum behavior.
5. Re-check RLS impact for both group and friend context.
6. In PR summary, explicitly state which invariant is preserved.

## Context-specific guardrails
- Group expenses/settlements: authorization is membership-driven.
- Friend expenses/settlements: authorization is participant-driven.
- RLS recursion risks exist when policies cross-reference `expenses` and `expense_splits`; use helper-function pattern instead of nested policy subqueries.
- SECURITY DEFINER RPCs are deliberate for atomicity and policy safety; avoid replacing them with multi-step client writes.

## Output format expected from agent
- “Files read” list (only relevant files).
- “Invariants checked” list.
- “Change surface” list grouped by Domain / Repository / SQL.
- “Risk notes” for RLS, rounding, and context mixing.
```

## Why this instruction set is efficient

- It is **ordered by dependency flow** (concepts → pure domain logic → repository orchestration → SQL/RLS), so agents build the right mental model quickly.
- It encodes **non-negotiable invariants up front**, reducing wasted iterations and invalid proposals.
- It includes a **task-to-file lookup**, which helps agents jump directly to likely edit points.
- It enforces **cross-layer tracing** for financial changes, preventing partial fixes (e.g., repository change without RPC/policy alignment).
- It captures the key Supabase nuance: **RLS + SECURITY DEFINER helper/RPC patterns are intentional architecture, not incidental implementation details**.

## Optional compact variant (for very small token budgets)

```md
Read first: docs/architecture.md; src/domain/splitting/index.ts; src/domain/balance/index.ts; src/repositories/supabase/expenseRepository.ts; migrations 0001/0003/0004/0015.
Never break: split sum == total, basis points == 10000, balances derived not stored, atomic expense RPC writes, nullable group_id context separation.
Before edits: trace Domain→Repository→SQL, then adjust tests and verify RLS for both group and friend contexts.
```
