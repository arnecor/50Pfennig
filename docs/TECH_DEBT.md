# Technical Debt Register

This is the single, authoritative log of known technical debt in Sharli. Whenever a change consciously leaves debt behind (a deferred refactor, a workaround, a partial solution), add an entry here with enough context for the next person to pick it up cleanly.

## How to use this file

- Add a new entry at the top of the **Open** section using the template below.
- When debt is paid down, move the entry to the **Resolved** section with a one-line note on how/when it was addressed (don't delete — the history is useful).
- Keep entries focused: one piece of debt per entry. Split if necessary.
- Reference concrete files and symbols so the work is unambiguous when someone picks it up.

## Entry template

```markdown
### <Short title>
- **Date added:** YYYY-MM-DD
- **Introduced by:** <PR / commit / feature name>
- **Severity:** low / medium / high
- **Affected files:** `path/to/file.ts`, `path/to/other.ts`
- **What's owed:** <one paragraph describing the gap between the current code and the clean target state>
- **Why deferred:** <reason — usually scope control, time pressure, or waiting on a dependency>
- **How to resolve:** <concrete steps for the next person>
- **Risk if ignored:** <what gets worse over time if this is never paid down>
```

---

## Open

### Profile operations split between `useAuth` hook and `profileRepository`
- **Date added:** 2026-04-19
- **Introduced by:** Account deletion feature (`f/accountDeletion` branch)
- **Severity:** low
- **Affected files:** `src/features/auth/hooks/useAuth.ts`, `src/repositories/supabase/profileRepository.ts`
- **What's owed:** `deleteOwnAccount()` was placed in the new `profileRepository`, but the pre-existing profile operations `updateDisplayName()` and `uploadAvatar()` still live inline in `useAuth.ts`. Repository ownership of profile mutations is therefore inconsistent: features that need profile reads/writes have to know which call lives where.
- **Why deferred:** The account deletion change set was already broad (schema migration touching 5 FKs, Edge Function, UI, i18n). Moving the existing two methods would have inflated the diff without changing behaviour and increased the regression surface for the deletion shipping.
- **How to resolve:** Move `updateDisplayName()` and `uploadAvatar()` from `src/features/auth/hooks/useAuth.ts` into `src/repositories/supabase/profileRepository.ts`. `useAuth` should retain only thin wrappers (or callers can use the repository directly via TanStack Query mutations). Update all call sites; verify `npx tsc --noEmit` passes and that avatar upload + display-name edit still work end-to-end on the Account page.
- **Risk if ignored:** New profile-touching features will keep accreting in `useAuth`, growing the hook into a god-object and making testing/replacing the auth layer harder.

---

## Resolved

### Install referrer stub (deferred deep links broken on Android)
- **Date added:** 2026-04-23 (retroactive — stub existed since Capacitor 6 migration)
- **Resolved:** 2026-04-23 — replaced stub in `src/lib/installReferrer.ts` with a custom Capacitor plugin (`InstallReferrerPlugin.java`) wrapping Google's official `com.android.installreferrer:installreferrer:2.2` library. No third-party npm package. iOS returns null gracefully; Swift implementation can be added later.
