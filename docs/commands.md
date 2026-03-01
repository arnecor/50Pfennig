# Dev Commands

**Environment**: `.env.local` (git-ignored):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm run dev           # Vite dev server
npm run build         # Production build
npm test              # Domain unit tests
npm run lint          # Biome lint (check only)
npm run format        # Biome format (check only)
npx biome check --fix             # Auto-fix safe issues (import order, formatting)
npx biome check --fix --unsafe    # Also fix isNaN→Number.isNaN, parseFloat→Number.parseFloat, etc.

npm run db:start      # Local Supabase (Docker)
npm run db:stop
npm run db:types      # Regenerate types.gen.ts
npm run db:migrate
npm run db:reset

npx cap sync android  # Sync to Android
npx cap open android  # Android Studio
```
