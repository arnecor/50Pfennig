# Dev Commands

## New Supabase Environment Setup

Steps required every time you create or reset a Supabase project (cloud or local).

### 1. Environment variables

Create `.env.local` (git-ignored):
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### 2. Run migrations

```bash
supabase db push          # cloud (prod/staging)
# or
npm run db:migrate        # local Docker
```

### 3. Deploy edge functions

```bash
supabase functions deploy send-push
```

### 4. Set secrets

```bash
supabase secrets set FCM_SERVICE_ACCOUNT_JSON '<contents-of-service-account.json>'
```

Get the service account JSON from Firebase Console → Project Settings → Service Accounts → Generate new private key. The project is `pfennig-50`.

### 5. Configure Database Webhooks

**Dashboard → Database → Webhooks → Create new webhook** — do this twice:

| Name | Table | Events | URL | Headers |
|---|---|---|---|---|
| `on_expense_insert` | `expenses` | INSERT | `https://<project-ref>.supabase.co/functions/v1/send-push` | `Authorization: Bearer <service_role_key>` |
| `on_group_member_insert` | `group_members` | INSERT | `https://<project-ref>.supabase.co/functions/v1/send-push` | `Authorization: Bearer <service_role_key>` |

> **Note:** These webhooks are NOT stored in code. They must be recreated manually whenever the Supabase project is reset or recreated. Missing webhooks = push notifications silently never fire (zero edge function invocations).

---

## Common Dev Commands

```bash
npm run dev           # Vite dev server
npm run build         # Production build
npm test              # Domain unit tests (vitest)
npm run test:watch    # Watch mode during development
npx tsc --noEmit      # TypeScript type check (run after every edit)

npm run lint          # Biome lint (check only — reports issues, no auto-fix)
npm run format        # Biome format (check only — reports issues, no auto-fix)
npx biome check --fix             # Auto-fix safe issues (import order, formatting)
npx biome check --fix --unsafe    # Also fix isNaN→Number.isNaN, parseFloat→Number.parseFloat, etc.

npm run db:start      # Local Supabase (Docker)
npm run db:stop
npm run db:types      # Regenerate types.gen.ts
npm run db:migrate
npm run db:reset

npx cap sync android  # Sync web assets to Android
npx cap open android  # Open Android Studio
```
