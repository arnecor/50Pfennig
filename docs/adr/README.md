# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the 50Pfennig project.

An ADR captures a significant architectural decision: the context that led to it, the decision itself, and its consequences. ADRs are append-only — they are never deleted. If a decision is reversed, a new ADR is written with status **Supersedes ADR-XXXX**.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-supabase-as-backend.md) | Supabase as the Backend Platform | Accepted |
| [0002](0002-domain-layer-separation.md) | Pure Domain Layer Separated from Infrastructure | Accepted |
| [0003](0003-integer-cents-for-money.md) | Represent Money as Integer Cents | Accepted |
| [0004](0004-offline-first-tanstack-query.md) | Offline-First via TanStack Query Cache + Mutation Queue | Accepted |
| [0005](0005-repository-pattern.md) | Repository Pattern for Data Access | Accepted |
| [0006](0006-atomic-expense-creation-via-rpc.md) | Atomic Expense Creation via Postgres RPC | Accepted |
| [0007](0007-expense-splits-as-snapshot.md) | Store Expense Splits as a Computed Snapshot | Accepted |
| [0008](0008-tanstack-router.md) | TanStack Router over React Router | Accepted |
| [0009](0009-balances-never-stored.md) | Balances Are Never Stored — Always Derived | Accepted |
| [0010](0010-i18n-from-day-one.md) | i18n Scaffolding from Day One (German + English) | Accepted |

## How to add a new ADR

1. Copy the template below into a new file: `NNNN-short-title.md`
2. Number sequentially from the last entry
3. Add it to the index above

```markdown
# ADR-NNNN: Title

- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

## Context

What problem or situation prompted this decision?

## Decision

What was decided, and why this option over the alternatives?

## Consequences

What are the positive, negative, and neutral results of this decision?
```
