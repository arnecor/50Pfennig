# 50Pfennig — Pre-Launch Cleanup Plan

**Goal:** Get the app into a clean, production-ready state before going live.
**Date written:** 2026-03-03
**Branch at time of writing:** `feature/issue-15-create-group`

---

## For the PO (non-technical summary)

The app already works end-to-end for the core flow: logging in, creating groups,
adding expenses, and viewing balances. What's left before going live is:

1. **Two screens are empty** — Settlements (paying back debts) and the "Add Friend"
   flow. Users currently see a blank screen or a pop-up placeholder.
2. **The database security rules have a known flaw** — when a user creates a group,
   three separate database calls happen in sequence, each of which could fail due
   to timing. We fixed the symptoms with patches, but the right fix is to bundle
   all three calls into a single database transaction (like we already do for
   expenses). This prevents future bugs and is the architecturally correct approach.
3. **The seed script needs a small fix** — the "Arne" test account is commented out.
   This should stay commented out on purpose (the account no longer exists in the
   cloud DB), but the script should be consistent and not mislead future developers.
4. **Minor housekeeping** — remove a stale migration file reference, ensure the
   migration history is clean and linear.

None of these are showstoppers today, but all of them should be done before
inviting real users.

---

## Technical context for Claude

### What's fully implemented (do not touch)
- Domain layer (`src/domain/`) — money, splitting, balance calculation
- All repositories (`src/repositories/`) — Supabase implementations for groups,
  expenses, friends, settlements
- Auth — login, signup, session, display name editing (`AccountPage` is complete)
- Routing + guards — all routes defined, auth guard works
- Expense form — full split editor (equal/exact/percentage), ParticipantPicker,
  group + friend expenses
- Friends — list, detail, remove friend, balance display (`FriendsPage` and
  `FriendDetailPage` are complete, only "Add Friend" flow is a stub)
- Groups — list, detail, create (`CreateGroupForm`), add members, `GroupDetailPage`
- Balances — `useTotalBalance`, `useGroupBalances`, `BalanceSummary`
- i18n — de/en, all keys in `public/locales/de/` and `public/locales/en/`
- shadcn/ui installed: `button`, `card`, `input`, `label` — no others

### What is stubbed / broken

#### 1. Group creation — RLS chicken-and-egg (ARCHITECTURAL FIX NEEDED)

**Current state:** Three separate Supabase client calls in `groupRepository.create()`:
1. `INSERT INTO groups` + `.select().single()`
2. `INSERT INTO group_members` (creator as first member) + `.select().single()`
3. Optionally N × `INSERT INTO group_members` (additional members from `useCreateGroup`)

Each call hits RLS independently. We patched this with migrations 0006–0008, adding
`created_by = auth.uid()` fallbacks to SELECT and INSERT policies. This works but
it's fragile — the policies are now more permissive than intended long-term.

**Correct fix:** Create a `create_group` Postgres RPC (SECURITY DEFINER), mirroring
`create_expense`. It should:
- Accept `p_name text`, `p_member_ids uuid[]` (optional)
- INSERT into `groups`
- INSERT into `group_members` for the creator
- INSERT into `group_members` for each `p_member_ids` entry
- Return the full group row
- After this is done, revert migrations 0006–0008 back to the original stricter
  policies (or write a new migration 0009 that reinstates them)

Files to change:
- New migration: `supabase/migrations/0009_create_group_rpc.sql`
- `src/repositories/supabase/groupRepository.ts` → `create()` calls `supabase.rpc('create_group', ...)`
- `src/repositories/types.ts` → update `CreateGroupInput` if needed
- `src/features/groups/hooks/useCreateGroup.ts` → simplify (no more separate `addMember` calls on creation)

#### 2. SettlementsPage — complete stub

File: `src/pages/SettlementsPage.tsx` — returns `null`.
File: `src/features/settlements/components/RecordSettlementSheet.tsx` — returns `null`.

Route: `/groups/:groupId/settlements`

What it needs to show:
- List of all settlements for the group, newest first
- Each row: who paid whom (`from_user_id` → `to_user_id`), amount, optional note,
  date, delete button (only for `from_user_id === auth.uid()`)
- A "Record settlement" button that opens `RecordSettlementSheet`
- `RecordSettlementSheet`: form with amount (numeric → cents), optional note,
  pre-populated `from` = current user, `to` = the biggest creditor from
  `simplifyDebts()`. Uses `settlementRepository` (already implemented).

Query options already exist: `settlementQueries.ts` (check if it has
`settlementsByGroupQueryOptions` — if not, add it following the pattern in
`expenseQueries.ts`).

Mutation hook: `useRecordSettlement` — create in
`src/features/settlements/hooks/useRecordSettlement.ts`, following `useCreateExpense`
as a template. Invalidates `['settlements', groupId]` and `['groups']` on success.

No new shadcn components needed — use `Card`, `Button`, `Input`, `Label`.
No Sheet component is installed; use a full-page overlay or inline form instead.

#### 3. Add Friend flow — placeholder only

File: `src/pages/FriendsPage.tsx` line 78–80: `handleAddFriend` calls `window.alert`.

What it needs:
- A simple form (inline or new page `/friends/add`) with an email input
- Look up the user by email via a Supabase query on `profiles` (join `auth.users`)
  or a new RPC `find_user_by_email` (SECURITY DEFINER, to avoid exposing all emails)
- Call `friendRepository.add(userId)` — check if this method exists; if not, add it
  to `src/repositories/supabase/friendRepository.ts`
- Invalidate `['friends']` on success

Note: `friendRepository` already has the friendship DB layer. The seed script
currently creates friendships directly; the UI path just needs the lookup + insert.

#### 4. Seed script — arne@arne.de commented out inconsistently

File: `scripts/seed.js` lines 191–201.

The `arne@arne.de` user creation is commented out, but:
- `users[0]` is referenced throughout (group members, friend pairs, expenses)
  but is never pushed into the `users` array when commented out → the seed
  will crash or silently use wrong indices if someone uncomments partially.
- The summary at the bottom still mentions `arne@arne.de`.

Fix options (pick one):
- **A (recommended):** Uncomment `arne@arne.de` fully and make it idempotent
  (check if user exists before creating, or use `upsert`). This is the intended
  fixed test user.
- **B:** Remove all references to index `[0]` being "Arne" and make all 10 users
  random. Update `FRIEND_PAIRS` and `FRIEND_EXPENSE_DEFS` to use index offsets that
  don't assume a fixed user.

#### 5. Migration history — 0006 is inconsistent

Migration `0006_fix_groups_select_after_insert.sql` was applied to the cloud, then
its content was updated locally (the `group_members` INSERT policy fix was added to
it after the fact). Migration `0007_fix_group_members_insert_policy.sql` covers the
same policy, creating a conflict in the migration history.

When the `create_group` RPC is implemented (item 1 above), write a clean migration
`0009` that:
1. Creates the `create_group` RPC
2. Reverts `groups` SELECT policy back to `is_group_member(id)` only
3. Reverts `group_members` INSERT policy back to `is_group_member(group_id)` only
4. Drops migrations 0006, 0007, 0008 from the tracking table (or marks them as
   superseded with a comment)

This way the migration history tells a coherent story.

---

## Priority order

| # | Item | Effort | Must-have for launch |
|---|------|--------|----------------------|
| 1 | `create_group` RPC + revert RLS patches | M | Yes — current patches are fragile |
| 2 | SettlementsPage + RecordSettlementSheet | L | Yes — core feature |
| 3 | Add Friend flow | M | Yes — users can't connect without seeding |
| 4 | Seed script fix | S | No — dev tooling only |
| 5 | Migration history cleanup | S | No — cosmetic, do alongside item 1 |

Effort: S = a few hours, M = half day, L = full day.

---

## Key files quick-reference

| What | Where |
|------|-------|
| Group repo | `src/repositories/supabase/groupRepository.ts` |
| Friend repo | `src/repositories/supabase/friendRepository.ts` |
| Settlement repo | `src/repositories/supabase/settlementRepository.ts` |
| useCreateGroup | `src/features/groups/hooks/useCreateGroup.ts` |
| SettlementsPage stub | `src/pages/SettlementsPage.tsx` |
| RecordSettlementSheet stub | `src/features/settlements/components/RecordSettlementSheet.tsx` |
| FriendsPage (add friend stub) | `src/pages/FriendsPage.tsx:78` |
| Migrations | `supabase/migrations/` |
| create_expense RPC (reference impl) | `supabase/migrations/0001_initial_schema.sql:281` |
| Expense queries (pattern to follow) | `src/features/expenses/expenseQueries.ts` |
| Seed script | `scripts/seed.js` |
