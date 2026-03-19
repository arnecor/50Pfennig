# 50Pfennig — Claude Code Source of Truth

Shared expense splitting app for small trust-based groups (2–10 people).  
React + Capacitor hybrid (Android-first, iOS later). German UI (de default, en secondary).

Full architectural rationale lives in [docs/adr/](docs/adr/).

## General coding guidelines
Always act like a professional Senir Developer. You code will be reviewed by codex.



## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict) + Vite |
| Mobile | Capacitor (Android now, iOS later) |
| Backend | Supabase — Postgres + Auth + Realtime + RLS |
| UI | Tailwind CSS + shadcn/ui + Lucide icons |
| Server state | TanStack Query v5 |
| Local/UI state | Zustand |
| Routing | TanStack Router v1 |
| Forms | React Hook Form + Zod |
| Linting/formatting | Biome |
| Package manager | npm |

## Project Structure

```
src/
├── domain/          # Pure TypeScript — ZERO deps on React, Supabase, or any library
├── lib/             # Infrastructure adapters (impure, side-effectful)
├── repositories/    # Data access abstraction — features never call Supabase directly
├── features/
│   ├── auth/
│   ├── balances/    # useTotalBalance — cross-group + cross-friend
│   ├── expenses/    # ExpenseForm, ParticipantPicker, mutation hooks, query options
│   ├── friends/     # useFriends hook (UI for adding friends is a future issue)
│   ├── groups/
│   └── settlements/
├── pages/           # Route-level components — thin wrappers, no business logic
├── components/
├── store/
└── router/

supabase/
└── migrations/      # SQL files — schema, RLS policies, RPC functions
```

## Path Aliases

```
@domain       → src/domain/
@lib          → src/lib/
@repositories → src/repositories/
@features     → src/features/
@components   → src/components/
@pages        → src/pages/
@store        → src/store/
@router       → src/router/
@             → src/          (fallback, prefer the specific aliases above)
```
## LSP Usage — Mandatory

Before using Grep/Glob/Read to navigate TypeScript code, you MUST call
`ToolSearch` with `"select:LSP"` to load the LSP tool and use it instead.

Specifically: finding a type/function definition → `goToDefinition`,
finding all usages → `findReferences`, discovering symbols → `workspaceSymbol`,
checking types → `hover`, listing file symbols → `documentSymbol`.

Grep/Glob is only acceptable for: comments, string literals, config files,
non-TypeScript files, or when LSP returns no results.

After writing or editing code, check LSP diagnostics before
moving on. Fix any type errors or missing imports immediately.

## UI Components

Only these shadcn/ui components are installed: `button`, `card`, `input`, `label`.
No toast / sonner / dialog / select. Use inline error state for form errors. If you want to add components, ask the user.

## Dependency Rule — Non-Negotiable

```
domain/       →  imports NOTHING outside src/domain/
repositories/ →  imports from domain/ and lib/supabase/ only
features/     →  imports from domain/, repositories/, store/, components/
pages/        →  imports from features/ and router/ only
```
## Where to find common tasks
- Split math rules: `src/domain/splitting/index.ts` (+ tests in `src/domain/splitting/splitting.test.ts`).
- Balance/debt logic: `src/domain/balance/index.ts` (+ tests in `src/domain/balance/balance.test.ts`).
- Expense write/read behavior: `src/repositories/supabase/expenseRepository.ts` and DB RPC migrations.
- Settlement behavior: `src/repositories/supabase/settlementRepository.ts` and `0001_schema.sql`.
- Friend lifecycle logic: `src/repositories/supabase/friendRepository.ts` and `0001_schema.sql`.
- Access bugs (permissions/visibility): inspect relevant RLS policies in migrations before touching UI.

## State Management Rules (Overview)

**TanStack Query** owns all server state.  
**Zustand** owns UI and device-local state.  
**Never put in Zustand:** group/expense/settlement data, computed balances.  
**Never put in TanStack Query:** UI state, auth session, offline queue.

Details: `@docs/state-management.md`

## Key Invariants

1. `sum(expense_splits.amount) === expenses.total_amount` for every expense
2. `sum(expense.split.basisPoints) === 10000` for every percentage split
3. No balance columns exist in any database table
4. Every user-visible string goes through `t('key')` — no hardcoded strings
5. `src/domain/` has zero imports from outside itself
6. Expense + splits are always written in a single Postgres transaction (via RPC)
7. `expenses.group_id` is **nullable** — `NULL` means friend expense; a set value means group expense. Never mix both in one expense.

## Load for specific topics

- `@docs/architecture.md` — DB schema, Money, Balances, Expense writes, Repositories
- `@docs/state-management.md` — TanStack Query details, Zustand stores, offline
- `@docs/coding-patterns.md` — Hooks, Mutations, Zod, i18n, Mappers
- `@docs/commands.md` — npm/Supabase/Capacitor commands
- `@STATUS.md` — Implementation status of stubs

## Output format expected from agent
- “Files read” list (only relevant files).
- “Invariants checked” list.
- “Change surface” list grouped by Domain / Repository / SQL.
- “Risk notes” for RLS, rounding, and context mixing.