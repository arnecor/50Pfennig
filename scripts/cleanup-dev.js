#!/usr/bin/env node
if (process.env.VITE_APP_ENV === 'production') {
  console.error('ERROR: Cleanup scripts cannot run against production. Use a dev or local environment.');
  process.exit(1);
}
/**
 * scripts/cleanup-dev.js
 *
 * Wipes ALL user data from the dev/local database so that seed scripts can
 * run against a clean slate. Safe to run repeatedly.
 *
 * Deletion order (respects FK constraints):
 *   1. settlements      — no cascade from groups/users; must go first
 *   2. expenses         — expense_splits cascade from expenses automatically
 *   3. groups           — group_members + group_events cascade automatically
 *   4. auth users       — cascades to: profiles → friendships, friend_invites,
 *                         push_tokens
 *
 * Usage:
 *   npm run db:cleanup-dev
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY. Add it to .env.development (get it from `npm run db:status` → Secret).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch all pages from admin.listUsers and return the full array. */
async function listAllUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('✗ listUsers:', error);
      process.exit(1);
    }
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return users;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🗑️   Cleaning up dev database…\n');

  // ── Step 1: Delete all settlements ────────────────────────────────────────
  console.log('💸  Deleting settlements…');
  const { count: settlementCount, error: settlementErr } = await supabase
    .from('settlements')
    .delete({ count: 'exact' })
    .gte('created_at', '1970-01-01');
  if (settlementErr) { console.error('✗ settlements:', settlementErr); process.exit(1); }
  console.log(`  ✓  ${settlementCount ?? 0} settlement(s) deleted`);

  // ── Step 2: Delete all expenses (expense_splits cascade) ──────────────────
  console.log('\n🧾  Deleting expenses (splits cascade)…');
  const { count: expenseCount, error: expenseErr } = await supabase
    .from('expenses')
    .delete({ count: 'exact' })
    .gte('created_at', '1970-01-01');
  if (expenseErr) { console.error('✗ expenses:', expenseErr); process.exit(1); }
  console.log(`  ✓  ${expenseCount ?? 0} expense(s) deleted (splits cascaded)`);

  // ── Step 3: Delete all groups (group_members + group_events cascade) ───────
  console.log('\n🏠  Deleting groups (members + events cascade)…');
  const { count: groupCount, error: groupErr } = await supabase
    .from('groups')
    .delete({ count: 'exact' })
    .gte('created_at', '1970-01-01');
  if (groupErr) { console.error('✗ groups:', groupErr); process.exit(1); }
  console.log(`  ✓  ${groupCount ?? 0} group(s) deleted (members + events cascaded)`);

  // ── Step 4: Delete all auth users (profiles + friendships etc. cascade) ────
  console.log('\n👤  Deleting auth users…');
  const allUsers = await listAllUsers();

  if (allUsers.length === 0) {
    console.log('  ✓  No users found');
  } else {
    for (const user of allUsers) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`✗ deleteUser ${user.email ?? user.id}:`, error);
        process.exit(1);
      }
      console.log(`  ✓  Deleted ${user.email ?? user.id}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅  Database cleaned. Ready for seeding.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
