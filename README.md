# 50Pfennig

Shared expense splitting app for small, trust-based groups (2–10 people). Split bills fairly, settle up simply.

German UI by default, English secondary. Android-first (iOS later) via Capacitor.

---

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
| Dates | date-fns |
| i18n | i18next + react-i18next (de default, en) |
| Testing | Vitest — domain layer only |
| Package manager | npm |

---

## Prerequisites

- Node.js 20+
- npm
- Docker (for local Supabase)
- Android Studio (for mobile builds)

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your local Supabase credentials (see step 3).

### 3. Start local Supabase

```bash
npm run db:start
```

This starts a local Supabase instance via Docker. On first run it pulls the Docker images — this takes a few minutes. Run `npm run db:status` to get the API URL and keys to put in `.env.local`.

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Generate TypeScript types from the schema

```bash
npm run db:types
```

### 6. Start the dev server

```bash
npm run dev
```

App is available at `http://localhost:3000`.

---

## Common Commands

```bash
npm run dev            # Start Vite dev server (local)
npm run build          # Build (no mode — defaults to Vite's "development" mode)
npm run build:dev      # Build targeting cloud dev/staging Supabase (.env.development)
npm run build:prod     # Build targeting production Supabase — for CI only
npm test               # Run domain unit tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run lint           # Biome lint
npm run lint:fix       # Biome lint with auto-fix
npm run format         # Biome format
npm run check          # Biome lint + format combined

npm run db:start       # Start local Supabase (Docker required)
npm run db:stop        # Stop local Supabase
npm run db:status      # Show local Supabase status + API URL + keys
npm run db:types       # Regenerate src/lib/supabase/types.gen.ts from schema
npm run db:migrate     # Push migrations to local Supabase
npm run db:reset       # Reset local DB and re-run all migrations + seed
npm run db:seed        # Seed local DB with test data (local only)
npm run db:seed:dev    # Seed cloud dev DB with test data (.env.development)

npx cap sync android   # Sync web build to Android project (run after npm run build)
npx cap open android   # Open Android Studio
npm run build && npx cap sync android  # Build and sync to Android
```

---

## Environments

The project uses three environments. **Production credentials never exist on a developer machine** — they live exclusively in CI secrets.

### Environment overview

| Environment | Supabase | Firebase | How to build | Who triggers |
|-------------|----------|----------|--------------|--------------|
| `local` | Local Docker | — | `npm run dev` | Developer |
| `development` | Cloud dev project | Dev Firebase project | `npm run build:dev` | Developer / CI on `develop` |
| `production` | Cloud prod project | Prod Firebase project | `npm run build:prod` | CI on `main` only |

### Git branches

| Branch | Maps to | Who pushes |
|--------|---------|-----------|
| `main` | Production | CI only (via PR merge) |
| `develop` | Cloud dev/staging | Developers |
| feature branches | Local only | Developers |

### Environment files

| File | Purpose | Committed? |
|------|---------|-----------|
| `.env.local` | Local Docker Supabase | No — gitignored |
| `.env.development` | Cloud dev Supabase | No — gitignored |
| `.env.production` | Production Supabase | **Never** — CI secrets only |
| `.env.local.example` | Template for `.env.local` | Yes |
| `.env.development.example` | Template for `.env.development` | Yes |

**Setting up `.env.local` (first time):**
```bash
cp .env.local.example .env.local
npm run db:start        # Start local Docker
npm run db:status       # Copy the API URL and keys into .env.local
```

**Setting up `.env.development` (cloud dev Supabase):**
```bash
cp .env.development.example .env.development
# Fill in credentials from your cloud dev Supabase project dashboard
```

### Required variables

```bash
VITE_APP_ENV=local|development|production   # Controls script guards
VITE_SUPABASE_URL=                          # Supabase project URL
VITE_SUPABASE_ANON_KEY=                     # Supabase public anon key
SUPABASE_SERVICE_KEY=                       # Service role key — scripts only, never baked into build
```

### Script guards

Every script in `scripts/` will **exit immediately** if `VITE_APP_ENV=production`. This prevents accidental seeding or data mutations on the production database, even if prod credentials were ever mistakenly placed in a local env file.

### Database migrations

```
Local dev  →  supabase db diff  →  new migration file  →  PR to develop
→  CI pushes migration to cloud dev project  →  validated
→  PR to main  →  CI pushes migration to prod (manual approval required)
```

Never run `supabase db push` locally against production. The prod Supabase project URL and service key exist only as CI environment secrets.

### Android build variants

When the production Firebase project is set up, Android `productFlavors` will separate dev and prod:

- `devDebug` → `com.arco.sharli.dev` — connects to dev Supabase, dev Firebase
- `prodRelease` → `com.arco.sharli` — connects to prod Supabase, prod Firebase

Each flavor has its own `google-services.json` placed under `android/app/src/dev/` and `android/app/src/prod/` respectively. Neither file is committed — they are injected by CI.

---

## Project Structure

```
src/
├── domain/          # Pure TypeScript — ZERO deps on React, Supabase, or any library
│   ├── types.ts     # All domain types (Money, Expense, Settlement, Group, etc.)
│   ├── money.ts     # Money arithmetic: add, subtract, allocate (largest-remainder)
│   ├── splitting/   # splitExpense() — equal / exact / percentage
│   └── balance/     # calculateGroupBalances(), simplifyDebts()
│
├── lib/             # Infrastructure adapters (impure, side-effectful)
│   ├── supabase/
│   │   ├── client.ts        # Supabase client singleton
│   │   ├── types.gen.ts     # DO NOT EDIT — generated by `npm run db:types`
│   │   └── mappers.ts       # DB row → domain type conversions
│   ├── storage/
│   │   ├── offlineQueue.ts  # Zustand mutation queue, persisted to IndexedDB
│   │   ├── queryPersister.ts
│   │   └── syncService.ts   # Flushes queue on connectivity restore
│   └── capacitor/
│       └── network.ts       # Capacitor Network plugin wrapper
│
├── repositories/    # Data access abstraction — features never call Supabase directly
│   ├── types.ts     # IGroupRepository, IExpenseRepository, ISettlementRepository
│   ├── supabase/    # Concrete Supabase implementations
│   └── index.ts     # Factory / binding
│
├── features/        # Self-contained feature modules
│   ├── auth/        # components/, hooks/, authStore.ts
│   ├── groups/      # components/, hooks/, groupQueries.ts
│   ├── expenses/    # components/SplitEditor/ (equal/exact/percentage sub-components)
│   ├── settlements/
│   └── balances/    # Derived display — no fetches, uses TQ cache data only
│
├── pages/           # Route-level components — thin wrappers, no business logic
├── components/
│   ├── ui/          # shadcn/ui generated components — DO NOT EDIT manually
│   └── shared/      # MoneyDisplay, UserAvatar, EmptyState, etc.
├── store/
│   ├── uiStore.ts   # selectedGroupId, activeSheet, expenseFormDraft
│   └── offlineStore.ts
└── router/
    ├── index.tsx    # TanStack Router route tree
    └── guards.tsx   # Auth guard

supabase/
└── migrations/      # SQL files — schema, RLS policies, RPC functions

public/
└── locales/
    ├── de/translation.json   # German (default)
    └── en/translation.json   # English
```

---

## Key Architectural Rules

### Money
- All monetary values are `Money` (integer cents, branded type). €12.50 = `money(1250)`.
- Use `allocate(total, ratios)` for any split calculation — largest-remainder method ensures results always sum exactly to the original.
- Percentages are stored as basis points (0–10000). 33.33% = `3333`.
- Display: always use `formatMoney(m)` from `src/domain/money.ts`.

### Balances
- Balances are **never stored in the database**. They are always derived client-side from cached expense_splits and settlements using `calculateGroupBalances()`.

### Expense writes
- Creating or updating an expense always calls `supabase.rpc('create_expense', {...})` — expenses + splits are written atomically in one Postgres transaction.

### Dependency rule
```
domain/       →  imports NOTHING outside src/domain/
repositories/ →  imports from domain/ and lib/supabase/ only
features/     →  imports from domain/, repositories/, store/, components/
pages/        →  imports from features/ and router/ only
```

---

## Testing

Only `src/domain/` is unit tested. Tests are co-located with the source files.

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report (≥90% lines/functions, ≥85% branches required)
```

---

## Files Never to Edit Manually

| File | Reason |
|---|---|
| `src/lib/supabase/types.gen.ts` | Generated by `npm run db:types` |
| `src/components/ui/*.tsx` | Managed by shadcn/ui (`npx shadcn@latest add`) |
| `android/` | Managed by Capacitor (`npx cap sync`) |

---

## Architecture Decision Records

Significant architectural decisions are documented in [docs/adr/](docs/adr/). Read these before making structural changes.

| # | Decision |
|---|---|
| [ADR-0001](docs/adr/0001-supabase-as-backend.md) | Supabase as the backend platform |
| [ADR-0002](docs/adr/0002-domain-layer-separation.md) | Pure domain layer separated from infrastructure |
| [ADR-0003](docs/adr/0003-integer-cents-for-money.md) | Represent money as integer cents |
| [ADR-0004](docs/adr/0004-offline-first-tanstack-query.md) | Offline-first via TanStack Query cache + mutation queue |
| [ADR-0005](docs/adr/0005-repository-pattern.md) | Repository pattern for data access |
| [ADR-0006](docs/adr/0006-atomic-expense-creation-via-rpc.md) | Atomic expense creation via Postgres RPC |
| [ADR-0007](docs/adr/0007-expense-splits-as-snapshot.md) | Store expense splits as a computed snapshot |
| [ADR-0008](docs/adr/0008-tanstack-router.md) | TanStack Router over React Router |
| [ADR-0009](docs/adr/0009-balances-never-stored.md) | Balances are never stored — always derived |
| [ADR-0010](docs/adr/0010-i18n-from-day-one.md) | i18n scaffolding from day one (German + English) |
