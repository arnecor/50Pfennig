# Deep Code Review Report

Date: 2026-03-15  
Reviewer: Senior Developer (independent audit)

## Scope & method

- Reviewed architecture and repository structure from `CLAUDE.md` and core docs.
- Reviewed representative and high-risk code paths across app runtime, repositories, Supabase SQL migrations, and Edge Functions.
- Ran automated checks (`vitest`, `biome lint`, production build) to cross-check static findings.

---

## Critical Issues

### 1) Push webhook endpoint accepts forged traffic without source/role verification
- **Severity:** Critical
- **Location:** `supabase/functions/send-push/index.ts` lines 331-383
- **Why this is a problem:**
  - The function trusts any POST body and immediately uses a service-role Supabase client (`SUPABASE_SERVICE_ROLE_KEY`) to resolve recipients and send notifications.
  - There is no verification that the caller is the Supabase webhook system (or at least `service_role`).
  - If the function is reachable with any valid JWT (or accidentally exposed), an attacker could trigger arbitrary push traffic/spam by crafting webhook payloads.
- **Suggested fix:**
  - Enforce caller identity: verify JWT claims and require `role=service_role` (or shared secret header).
  - Reject requests that do not match expected webhook schema and signed secret.
  - Consider idempotency keys/rate limiting for replay protection.
- **Effort:** **M**

### 2) Friend invite tokens are readable by any authenticated user
- **Severity:** Critical
- **Location:** `supabase/migrations/0014_friend_invites.sql` lines 52-55
- **Why this is a problem:**
  - RLS allows any authenticated user to `SELECT` all rows from `friend_invites`.
  - Invite token theft is possible: tokens can be harvested and accepted by unintended users.
  - This defeats the “share link privately” trust model.
- **Suggested fix:**
  - Replace policy with least privilege: users should only read invites they created (`inviter_id = auth.uid()`), or remove direct table reads entirely.
  - Move token validation strictly inside `accept_friend_invite` SECURITY DEFINER function.
  - Optionally store only hashed tokens and compare hashes on acceptance.
- **Effort:** **M**

### 3) SECURITY DEFINER functions do not pin `search_path`
- **Severity:** Critical
- **Location:**
  - `supabase/migrations/0001_initial_schema.sql` lines 281-292, 348-359
  - `supabase/migrations/0004_fix_rls_recursion.sql` lines 29-33
  - `supabase/migrations/0014_friend_invites.sql` lines 70-73, 107-110, 175-178, 207-210
  - `supabase/migrations/0015_settlement_batches.sql` lines 16-24, 95-100
  - `supabase/migrations/0002_profiles.sql` lines 52-55
- **Why this is a problem:**
  - SECURITY DEFINER routines should explicitly set `search_path` to trusted schemas (typically `public, pg_temp`) to prevent function/operator shadowing risks.
  - Current definitions omit this hardening pattern.
- **Suggested fix:**
  - Add `set search_path = public, pg_temp` to each SECURITY DEFINER function.
  - Recreate existing functions with the safer signature and re-run migration.
- **Effort:** **M**

### 4) Deep link callback scheme mismatch breaks auth confirmation flow
- **Severity:** Critical
- **Location:**
  - `src/features/auth/hooks/useAuth.ts` line 39
  - `capacitor.config.ts` line 4
  - `src/App.tsx` lines 74-75 (and invite comments at 83)
- **Why this is a problem:**
  - Signup uses redirect `com.pfennig50.app://auth/callback`, but app id/package is `com.arco.sharli`.
  - In practice, email confirmation/login deep links may fail to return to the app in production.
- **Suggested fix:**
  - Centralize app scheme in one constant and reuse across auth signup, invite function, and deep-link handling.
  - Align all references with actual Capacitor app id/package.
- **Effort:** **S**

---

## Major Issues

### 1) Offline-first architecture is documented but core implementation is still stubbed
- **Location:**
  - `src/lib/storage/offlineQueue.ts` lines 25-41
  - `src/lib/storage/syncService.ts` lines 23-38
  - `src/features/balances/hooks/useGroupBalances.ts` lines 24-26
- **Impact:**
  - Runtime behavior does not match documented architecture; expected resilience features are absent.
  - Team and product stakeholders may assume capabilities that do not exist yet.
- **Suggested fix:**
  - Either implement these modules fully or remove/flag feature claims in docs and app comments.
- **Effort:** **L**

### 2) Repository boundary is bypassed in feature layer
- **Location:**
  - Rule in `CLAUDE.md` lines 84-88
  - Violations in `src/features/auth/hooks/useAuth.ts` lines 36-67
- **Impact:**
  - Tight coupling to Supabase in feature code makes backend swapping harder and violates project’s stated architecture contract.
- **Suggested fix:**
  - Move auth/profile mutations behind `IAuthRepository`/`IProfileRepository` abstraction.
- **Effort:** **M**

### 3) High computational complexity in `useTotalBalance`
- **Location:** `src/features/balances/hooks/useTotalBalance.ts` lines 85-98
- **Impact:**
  - Repeated `filter` scans per friend over expense and settlement arrays creates O(F*E + F*S) behavior per recompute.
  - This will degrade on larger histories and low-end devices.
- **Suggested fix:**
  - Pre-index friend expenses and settlements by counterpart id once (`Map<UserId, ...>`) inside memo.
  - Avoid per-friend full-array scans.
- **Effort:** **M**

### 4) Lint baseline is failing with many correctness/style violations
- **Location:** `npm run lint` output (40 errors, including hook dependency, non-null assertions, and typing issues)
- **Impact:**
  - Quality gate is effectively red; teams may miss regressions among noisy diagnostics.
- **Suggested fix:**
  - Triage lint into blocking categories; fix correctness first (`useExhaustiveDependencies`, unsafe assertions).
- **Effort:** **M**

### 5) Type safety is intentionally bypassed in repository RPC calls
- **Location:** `src/repositories/supabase/friendRepository.ts` lines 59-103 and `src/repositories/supabase/groupRepository.ts` (RPC cast)
- **Impact:**
  - `as any` removes compile-time guarantees for RPC signatures and response shapes.
  - Increases runtime failure risk after schema drift.
- **Suggested fix:**
  - Regenerate Supabase types and remove `any` casts.
  - Add runtime validation for RPC payload/result (e.g., Zod).
- **Effort:** **S/M**

### 6) Build output has large bundle chunk
- **Location:** `npm run build` warning (`dist/assets/index-*.js` ~858 kB minified)
- **Impact:**
  - Slower startup/download, especially on mobile networks/devices.
- **Suggested fix:**
  - Add route-level code splitting, lazy-load heavy modules (QR/scanner/friends flows), and tune manual chunks.
- **Effort:** **M**

---

## Minor Issues

1. **No dedicated `typecheck` script in package scripts** (`package.json` lines 6-27), causing inconsistent local CI habits.  
   **Fix:** add `"typecheck": "tsc -b --noEmit"` (or equivalent).

2. **Comments/docs drift in App deep-link docs** (`src/App.tsx` lines 74-85) still references old scheme naming, increasing onboarding confusion.  
   **Fix:** keep comments synchronized with real constants.

3. **`removeAllListeners()` usage is broad** in `App.tsx` teardown (near deep-link effect), which may unintentionally remove unrelated listeners if app structure grows.  
   **Fix:** keep the specific listener handle and remove only that.

4. **Accessibility lint findings in UI components** (from lint run) indicate avoidable a11y debt.  
   **Fix:** address role/semantic SVG and status role issues before release.

5. **Many non-null assertions (`!`) in UI/repository code** (lint diagnostics), reducing runtime safety under edge data conditions.  
   **Fix:** replace with explicit guards and typed narrowing.

6. **Test suite excludes non-domain layers by design** (`vitest.config.ts` lines 8-14), leaving integration paths unverified.  
   **Fix:** add targeted repository and hook integration tests.

---

## Architecture Review

### Structural weaknesses
- Core architectural rule says features should not import Supabase directly, but auth feature does, weakening the abstraction boundary.
- Multiple TODO/stub modules in critical infra paths indicate architecture is partially aspirational.

### Coupling problems
- App startup logic (`App.tsx`) mixes auth hydration, deep-link parsing, pending-invite handling, push setup, and cache lifecycle. This creates a high-coupling “god component” risk.

### Missing abstractions
- No typed auth repository despite clear repository pattern elsewhere.
- Deep-link scheme/package constants are duplicated across app client and edge function.

### Scaling risks
- Balance derivation currently recomputes with repeated scans and multiple parallel per-group queries.
- Bundle size warning already signals probable startup/performance scaling issues for mobile.

---

## Security Review

### Confirmed high-risk vectors
- Forged or unauthorized invocation path for push webhook handler.
- Over-permissive `friend_invites` read policy exposing active invite tokens.
- SECURITY DEFINER hardening gap (`search_path`) across many SQL functions.

### Additional concerns
- `search_user_by_email` allows exact-email user discovery (`0014_friend_invites.sql` lines 175-190); while product-required, it can aid enumeration. Add rate limits and abuse detection.
- No explicit anti-abuse controls/rate limiting surfaced in edge function handlers.

---

## Test Coverage Review

### What exists
- Strong domain-level tests (money, splitting, balance, settlement).

### Gaps
- No integration tests for repositories against RLS/RPC behavior.
- No tests for deep-link auth callback and invite flows.
- No tests for push notification webhook auth/path validation.
- No tests for auth/store hydration race scenarios and sign-out cache purging behavior.
- No tests for SQL function concurrency edge cases (double accept, duplicate friend add race).

---

## Recommendations

1. **Fix critical security issues first** (push endpoint auth, invite token RLS, SECURITY DEFINER `search_path`).
2. **Standardize deep-link/app identity constants** across client + edge + auth settings to prevent login/signup regressions.
3. **Reinforce architecture boundaries** by introducing auth/profile repositories and removing direct Supabase usage from feature hooks.
4. **Stabilize quality gates**: get lint to green, add typecheck script, and enforce in CI.
5. **Expand automated testing beyond domain** with repository integration tests (Supabase local), and route-level flow tests for auth/invite.
6. **Address scale concerns**: pre-index balance computations, add route code splitting, and monitor bundle budgets.
7. **Resolve doc/code drift** by updating status docs and comments whenever stubs are shipped.

---

## Assumptions / uncertainties

- Supabase Edge Function JWT verification defaults/config can differ by deployment; the push endpoint risk rating assumes endpoint can be reached by tokens broader than database webhooks.
- This review is static + local command based and does not include penetration testing against deployed infrastructure.
