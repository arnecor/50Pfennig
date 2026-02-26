# ADR-0002: Pure Domain Layer Separated from Infrastructure

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

The core business logic of this app — how expenses are split, how balances are calculated — is the primary source of correctness risk. A bug in the split algorithm or balance derivation silently affects multiple users' financial records simultaneously.

The splitting and balance logic could be written:
- **Inline in React components** — fast to write, impossible to test in isolation
- **In Supabase Postgres functions** — close to the data, hard to unit test, no TypeScript
- **In a separate pure TypeScript layer** — no framework dependencies, fully unit testable

## Decision

All splitting and balance calculation logic lives in `src/domain/` as **pure TypeScript functions with zero dependencies** on React, Supabase, Zustand, or any other library.

```
src/domain/
├── types.ts          # All domain types (Money, Expense, Settlement, etc.)
├── money.ts          # Money arithmetic
├── splitting/        # splitExpense() — equal, exact, percentage
└── balance/          # calculateGroupBalances(), simplifyDebts()
```

The dependency rule: `domain/` may import nothing outside of itself. This is enforced by convention (no tooling needed — a wrong import is immediately visible as a missing module).

## Consequences

- **Positive:** Domain tests run in a plain Node.js process with Vitest. No mocks, no test doubles, no React setup required. Tests are fast and reliable.
- **Positive:** The algorithms can be understood, audited, and corrected without reading any UI or infrastructure code.
- **Positive:** The domain layer is reusable. If a Node.js backend is added later (see ADR-0001), it can import the same functions.
- **Positive:** Changing the persistence layer (e.g. from Supabase to PowerSync) does not require touching domain logic.
- **Negative:** Slight upfront discipline required: developers must resist the temptation to import React hooks or Supabase client inside `domain/`. Code review should catch violations.
