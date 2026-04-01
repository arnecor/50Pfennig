# Sharli

Shared expense splitting app for small, trust-based groups (2–10 people). Split bills fairly, settle up simply.

German UI by default, English secondary. Android-first (iOS later) via Capacitor.

---

## Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Android App (Capacitor + React)                                    │
│  • Business logic, UI, offline cache (TanStack Query + IndexedDB)  │
│  • Calls Supabase REST/Realtime directly from the device            │
└────────────┬──────────────────────────┬────────────────────────────┘
             │ REST / Realtime          │ Deep links / Invite URLs
             ▼                          ▼
┌────────────────────────┐  ┌──────────────────────────────────────┐
│  Supabase (cloud)      │  │  Vercel  (invite.sharli.app)         │
│                        │  │                                      │
│  • Postgres DB         │  │  • Landing pages for invite links    │
│  • Auth (magic link,   │  │    /f/:token → friend invite page    │
│    OAuth)              │  │    /g/:token → group invite page     │
│  • Row-Level Security  │  │  • Serverless API functions          │
│  • Realtime            │  │    api/invite/friend.ts              │
│  • Edge Functions      │  │    api/invite/group.ts               │
│    (Deno runtime)      │  │  • Reads Supabase DB to render       │
│    → send-push         │  │    invite landing pages              │
│                        │  └──────────────────────────────────────┘
│  • Database Webhooks   │
│    → trigger send-push │  ┌──────────────────────────────────────┐
│    on expense/member   │  │  Firebase  (Google Cloud)            │
│    INSERT events       │──▶  • Firebase Cloud Messaging (FCM)    │
└────────────────────────┘  │  • Push notifications to devices     │
                             │  • Project: pfennig-50              │
                             └──────────────────────────────────────┘
```

---

## Where Things Run

### Android App (on-device)
- React 18 + TypeScript UI, built with Vite, wrapped in Capacitor
- All business logic: splitting, balance calculations, form validation
- Offline cache: TanStack Query with IndexedDB persistence
- Communicates with Supabase directly via `@supabase/supabase-js`

### Supabase (managed cloud)

| What | Details |
|---|---|
| **Postgres database** | All tables: `groups`, `group_members`, `expenses`, `expense_splits`, `settlements`, `friendships`, `group_invites`, `profiles`, `push_tokens` |
| **Auth** | Magic link + OAuth. Custom email templates in `supabase/mailtemplates/` |
| **Row-Level Security** | Enforced at DB level — all tables have RLS policies defined in migrations |
| **Realtime** | Live sync across devices (enabled via `0006_enable_realtime.sql`) |
| **Edge Function: `send-push`** | Deno runtime. Triggered by database webhooks. Calls FCM to deliver push notifications |
| **Database Webhooks** | Configured **manually** in Supabase dashboard — fire `send-push` on `expenses INSERT` and `group_members INSERT`. Not stored in code. |
| **RPC functions** | Postgres functions for atomic operations: `create_expense`, `leave_group`, `add_member_with_event`, `create_settlement_batch`, `accept_friend_invite`, `accept_group_invite`, `create_group_invite` |

All schema, RLS policies, and RPC functions live in `supabase/migrations/`.

### Vercel (`invite.sharli.app`)

| What | Details |
|---|---|
| **Friend invite landing page** | `api/invite/friend.ts` — rendered at `/f/:token` |
| **Group invite landing page** | `api/invite/group.ts` — rendered at `/g/:token` |
| **Purpose** | Users without the app tap an invite link in their browser. The page shows who invited them and links to Play Store / App Store. |
| **DB access** | Reads from Supabase using the service role key (invite token → inviter name, group name) |
| **Config** | `vercel.json` at repo root handles all routing |

### Firebase (Google Cloud)

| What | Details |
|---|---|
| **Firebase Cloud Messaging (FCM)** | Delivers push notifications to Android devices |
| **Project** | `pfennig-50` in Firebase Console |
| **Used by** | The `send-push` Supabase Edge Function — authenticates via a service account JSON and calls the FCM HTTP v1 API |
| **Not used** | Firebase is **only** used for FCM push delivery — no Firestore, no Firebase Auth, no Analytics |

---

## Setup Checklist (New Environment)

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Create `.env.local` (git-ignored):
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```
3. Run all migrations:
   ```bash
   supabase db push
   ```
4. Deploy the edge function:
   ```bash
   supabase functions deploy send-push
   ```
5. Set the Firebase secret (get the JSON from Firebase — see step 2 below):
   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT_JSON '<contents-of-service-account.json>'
   ```
6. Create database webhooks **manually** in the Supabase dashboard:

   **Dashboard → Database → Webhooks → Create new webhook** (do this twice)

   | Name | Table | Event | URL | Header |
   |---|---|---|---|---|
   | `on_expense_insert` | `expenses` | INSERT | `https://<ref>.supabase.co/functions/v1/send-push` | `Authorization: Bearer <service_role_key>` |
   | `on_group_member_insert` | `group_members` | INSERT | `https://<ref>.supabase.co/functions/v1/send-push` | `Authorization: Bearer <service_role_key>` |

   > **Important:** These webhooks are NOT in code. They must be recreated whenever the Supabase project is reset. Missing webhooks = push notifications silently never fire (zero edge function invocations).

7. Upload custom email templates from `supabase/mailtemplates/` in the Supabase dashboard under **Auth → Email Templates**.

### 2. Firebase

1. Open [Firebase Console](https://console.firebase.google.com) → project `pfennig-50`
2. **Project Settings → Service Accounts → Generate new private key**
3. Download the JSON — this is the value for `FCM_SERVICE_ACCOUNT_JSON`
4. Set the secret in Supabase (step 1.5 above)

> Firebase is only used for push delivery. There is no Firebase SDK initialized in the app — FCM token registration uses the Capacitor Push Notifications plugin directly.

### 3. Vercel

1. Connect the repo to a Vercel project and set the domain to `invite.sharli.app`
2. Set environment variables in the Vercel dashboard:
   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
3. `vercel.json` at the repo root handles all routing — no further configuration needed.

### 4. Local development

```bash
npm install
npm run db:start        # Start local Supabase (requires Docker)
npm run db:status       # Copy API URL + keys into .env.local
npm run db:migrate      # Apply all migrations
npm run db:types        # Regenerate TypeScript types from schema
npm run dev             # Vite dev server
```

Android build:
```bash
npm run build
npx cap sync android
npx cap open android    # Opens Android Studio
```

---

## Environments

The project uses three environments. **Production credentials never exist on a developer machine** — they live exclusively in CI secrets.

| Environment | Supabase | Firebase | How to build | Who triggers |
|---|---|---|---|---|
| `local` | Local Docker | — | `npm run dev` | Developer |
| `development` | Cloud dev project | Dev Firebase project | `npm run build:dev` | Developer / CI on `develop` |
| `production` | Cloud prod project | Prod Firebase project | `npm run build:prod` | CI on `main` only |

### Git branches

| Branch | Maps to | Who pushes |
|---|---|---|
| `main` | Production | CI only (via PR merge) |
| `develop` | Cloud dev/staging | Developers |
| feature branches | Local only | Developers |

### Environment files

| File | Purpose | Committed? |
|---|---|---|
| `.env.local` | Local Docker Supabase | No — gitignored |
| `.env.development` | Cloud dev Supabase | No — gitignored |
| `.env.production` | Production Supabase | **Never** — CI secrets only |
| `.env.local.example` | Template for `.env.local` | Yes |
| `.env.development.example` | Template for `.env.development` | Yes |

### Required variables

```bash
VITE_APP_ENV=local|development|production   # Controls script guards
VITE_SUPABASE_URL=                          # Supabase project URL
VITE_SUPABASE_ANON_KEY=                     # Supabase public anon key
SUPABASE_SERVICE_KEY=                       # Service role key — scripts only, never baked into build
```

### Script guards

Every script in `scripts/` exits immediately if `VITE_APP_ENV=production`. This prevents accidental seeding or data mutations on the production database.

### Database migrations

```
Local dev  →  supabase db diff  →  new migration file  →  PR to develop
→  CI pushes migration to cloud dev project  →  validated
→  PR to main  →  CI pushes migration to prod (manual approval required)
```

Never run `supabase db push` locally against production.

### Android build variants

When the production Firebase project is set up, Android `productFlavors` will separate dev and prod:

- `devDebug` → `com.arco.sharli.dev` — connects to dev Supabase, dev Firebase
- `prodRelease` → `com.arco.sharli` — connects to prod Supabase, prod Firebase

Each flavor has its own `google-services.json` placed under `android/app/src/dev/` and `android/app/src/prod/` respectively. Neither file is committed — they are injected by CI.

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
| Push notifications | Firebase Cloud Messaging via Supabase Edge Function |
| Invite landing pages | Vercel serverless functions |
| Linting/formatting | Biome |
| Dates | date-fns |
| i18n | i18next + react-i18next (de default, en) |
| Testing | Vitest — domain layer only |
| Package manager | npm |

---

## Common Commands

```bash
npm run dev            # Start Vite dev server (local)
npm run build          # Build (defaults to Vite's "development" mode)
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

npx cap sync android   # Sync web build to Android project (run after build)
npx cap open android   # Open Android Studio
```

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
│   ├── auth/
│   ├── groups/
│   ├── expenses/
│   ├── settlements/
│   └── balances/    # Derived display — no fetches, uses TQ cache data only
│
├── pages/           # Route-level components — thin wrappers, no business logic
├── components/
│   ├── ui/          # shadcn/ui generated components — DO NOT EDIT manually
│   └── shared/      # MoneyDisplay, UserAvatar, EmptyState, etc.
├── store/
│   ├── uiStore.ts
│   └── offlineStore.ts
└── router/
    ├── index.tsx    # TanStack Router route tree
    └── guards.tsx   # Auth guard

api/
└── invite/
    ├── friend.ts    # Vercel serverless function — friend invite landing page
    └── group.ts     # Vercel serverless function — group invite landing page

supabase/
├── functions/
│   └── send-push/   # Edge function: push notifications via FCM
├── migrations/      # SQL files — schema, RLS policies, RPC functions
└── mailtemplates/   # Custom Supabase Auth email templates

public/
└── locales/
    ├── de/translation.json   # German (default)
    └── en/translation.json   # English
```

---

## Key Architectural Rules

- **Balances are never stored** — always derived from `expense_splits` + `settlements` client-side
- **Expense creation is atomic** — via Postgres RPC (`create_expense`), never two separate inserts
- **`expenses.group_id` is nullable** — `NULL` = friend expense, set = group expense, never mixed
- **Domain layer (`src/domain/`) has zero external dependencies** — pure TypeScript functions only
- **Features never call Supabase directly** — always go through repository interfaces in `src/repositories/`
- **All money is integer cents** — `Money` branded type, basis points for percentages

### Dependency rule

```
domain/       →  imports NOTHING outside src/domain/
repositories/ →  imports from domain/ and lib/supabase/ only
features/     →  imports from domain/, repositories/, store/, components/
pages/        →  imports from features/ and router/ only
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
| [ADR-0011](docs/adr/0011-friends-and-flexible-expenses.md) | Friends and flexible expense contexts |
| [ADR-0012](docs/adr/0012-settlement-allocation-across-contexts.md) | Settlement allocation across contexts |
