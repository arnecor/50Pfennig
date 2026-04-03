# Group Invite Concept — Feasibility & Architecture Review

## Verdict

The concept is **implementable** with the current stack and architecture, but it needs a few critical adjustments before implementation to avoid security holes, consistency issues, and boundary leakage.

## What Works Well

- Reusing the friend-invite deep-link + Vercel pattern is pragmatic and should reduce implementation risk.
- Defining `accept_group_invite` as an RPC keeps membership + event write atomic.
- Idempotent acceptance behavior is explicitly considered.
- Multi-use token model matches real-world group chat sharing behavior.

## Critical Risks / Potential Breakages

### 1) Authorization gap in `create_group_invite`

The concept says "group admin can revoke" but also says "group members can create". This creates an ownership/abuse gap (any member can create persistent multi-use links).

**Risk:** uncontrolled invitation growth and weak moderation.

**Recommendation:** decide one clear rule:
- either only admins can create/revoke invites, or
- members can create but invite capability is explicitly represented in `group_members.role`/permissions.

### 2) Token brute-force risk (6 chars)

A 6-char uppercase alphanumeric token has limited entropy for a **multi-use** capability token.

**Risk:** successful enumeration can silently add attackers into groups.

**Recommendation:**
- Increase token length (e.g., 10-12 chars),
- Add RPC-level rate limiting / attempt throttling,
- Log failed attempts for abuse detection,
- Consider storing only token hash server-side.

### 3) Incomplete transaction semantics for friendship creation

The concept requires creating friendship as part of invite acceptance.

**Risk:** if friendship insert fails unexpectedly, either membership fails (too strict) or partial side effects happen (non-atomic).

**Recommendation:** explicitly define behavior:
- **Preferred:** membership + event are mandatory atomic core;
- friendship creation is best-effort but still performed inside RPC with conflict-safe upsert and deterministic ordering (`least/greatest`) to avoid duplicates.

### 4) Missing reference concept file

The document references `docs/concepts/add-friends.md`, which does not exist in the repository.

**Risk:** unclear source of truth and implementation ambiguity.

**Recommendation:** fix reference (or add the missing concept) before development.

### 5) Clean-architecture leakage risk in `App.tsx`

Putting invite parsing + acceptance orchestration directly into `App.tsx` can turn it into a side-effect hub.

**Risk:** routing/auth/bootstrap logic becomes coupled and hard to test.

**Recommendation:** isolate into feature modules:
- `features/invites/lib/parseInviteToken.ts`
- `features/invites/hooks/usePendingInviteAcceptance.ts`
- keep `App.tsx` as a thin bootstrap coordinator.

## Data/RLS Design Notes

1. `group_invites` RLS should **not** allow arbitrary SELECT by authenticated users; only group members (or creator/admin as defined).
2. `accept_group_invite` should be `SECURITY DEFINER` with strict checks:
   - token valid, not expired, not revoked,
   - caller authenticated,
   - membership insert idempotent,
   - return canonical `group_id` only.
3. Add partial index for active-token lookup:
   - `(group_id)` with `revoked_at is null` and `expires_at > now()` is not immutable due to `now()`; use `expires_at` ordering + `revoked_at is null` and filter in query.
4. Enforce one active token per group logically in RPC (advisory lock or `FOR UPDATE`), otherwise race conditions can create multiple active tokens.

## Domain/Repository Boundary Check

To keep architecture clean:

- Add an invite-focused repository contract (or extend group repository in a dedicated invite section), but keep Supabase RPC calls out of components/pages.
- Keep token parsing and invite-type discrimination out of repository layer; that belongs to feature/lib or app bootstrap utilities.
- Keep Vercel landing-page query logic separate from app domain logic.

## Suggested Implementation Plan (Safe Order)

1. **SQL migration**: table + indexes + RLS + RPCs (`create_group_invite`, `accept_group_invite`) + tests for race/idempotency.
2. **Repository methods** in `groupRepository` with typed return contract.
3. **Feature layer**: `useAcceptGroupInvite`, pending group invite store, and parser utilities.
4. **App integration**: deep-link + install referrer flow wiring.
5. **UI entrypoint**: Group settings invite action.
6. **Observability**: audit logs/metrics for invite creation and acceptance failures.

## Recommended Acceptance Criteria

- Accepting same token twice by same user is idempotent and returns same group.
- Concurrent accepts from multiple users succeed without duplicate membership rows.
- Concurrent invite creation results in one active token (or deterministic latest-token rule).
- Revoked/expired token cannot add members.
- Friendship creation does not produce `(A,B)` + `(B,A)` duplicates.
- Non-members cannot read group invite tokens via RLS.

## Final Assessment

Proceed with implementation **after** tightening token security, clarifying role permissions, and hardening RPC race/idempotency semantics. With these changes, the concept fits the current architecture and should not break existing group/balance invariants.
