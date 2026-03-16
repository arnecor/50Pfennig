#!/usr/bin/env node
if (process.env.VITE_APP_ENV === 'production') {
  console.error('ERROR: Seed scripts cannot run against production. Use a dev or local environment.');
  process.exit(1);
}
/**
 * scripts/seed-val-users.js
 *
 * Creates a minimal, deterministic validation dataset:
 *   - 4 fixed users: a@val.com, b@val.com, c@val.com, d@val.com (password: 123456)
 *   - All users befriended with each other (6 pairs)
 *   - Group "ABC" created by a@val.com, with b@val.com and c@val.com as members
 *
 * Usage:
 *   npm run db:seed-val-users
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from .env.local automatically.
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY. Add it to .env.local (get it from `npm run db:status` → Secret).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function must(label, result) {
  if (result.error) {
    console.error(`\n✗ ${label}:`);
    console.error(result.error);
    process.exit(1);
  }
  return result.data;
}

// ── User definitions ──────────────────────────────────────────────────────────

const USER_DEFS = [
  { email: 'a@val.com', displayName: 'Validate A' },
  { email: 'b@val.com', displayName: 'Validate B' },
  { email: 'c@val.com', displayName: 'Validate C' },
  { email: 'd@val.com', displayName: 'Validate D' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Seeding validation users…\n');

  // ── Step 1: Create users ───────────────────────────────────────────────────
  console.log('👤  Creating 4 validation users…');
  const users = [];

  for (const def of USER_DEFS) {
    const data = must(
      `createUser ${def.email}`,
      await supabase.auth.admin.createUser({
        email: def.email,
        password: '123456',
        email_confirm: true,
        user_metadata: { display_name: def.displayName },
      }),
    );

    users.push(data.user);
    console.log(`  ✓  ${def.email}  →  ${def.displayName}`);
  }

  // ── Step 2: Create all friendships (6 pairs) ──────────────────────────────
  console.log('\n🤝  Creating friendships (all pairs)…');

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      must(
        `friendship ${USER_DEFS[i].email} ↔ ${USER_DEFS[j].email}`,
        await supabase.from('friendships').insert({
          requester_id: users[i].id,
          addressee_id: users[j].id,
          status: 'accepted',
        }),
      );
      console.log(`  ✓  ${USER_DEFS[i].email} ↔ ${USER_DEFS[j].email}`);
    }
  }

  // ── Step 3: Create group "ABC" with a, b, c ────────────────────────────────
  console.log('\n🏠  Creating group "ABC"…');

  const [userA, userB, userC] = users;

  const group = must(
    'createGroup "ABC"',
    await supabase
      .from('groups')
      .insert({ name: 'ABC', created_by: userA.id })
      .select()
      .single(),
  );

  must(
    'addMembers "ABC"',
    await supabase.from('group_members').insert([
      { group_id: group.id, user_id: userA.id },
      { group_id: group.id, user_id: userB.id },
      { group_id: group.id, user_id: userC.id },
    ]),
  );

  console.log(`  ✓  "ABC"  (a, b, c)  id=${group.id}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅  Validation seed complete!\n');
  console.log('   Users:       a@val.com, b@val.com, c@val.com, d@val.com  /  123456');
  console.log('   Friendships: all pairs (6 total)');
  console.log('   Group "ABC": a@val.com (creator) + b@val.com + c@val.com\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
