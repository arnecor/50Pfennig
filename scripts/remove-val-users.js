#!/usr/bin/env node
if (process.env.VITE_APP_ENV === 'production') {
  console.error('ERROR: Data-mutation scripts cannot run against production. Use a dev or local environment.');
  process.exit(1);
}
/**
 * scripts/remove-val-users.js
 *
 * Removes everything created by (or involving) the validation users:
 *   a@val.com, b@val.com, c@val.com, d@val.com
 *
 * Deletion order (respects FK constraints — no CASCADE on expenses/groups):
 *   1. Settlements  — from_user_id / to_user_id ref auth.users (no cascade)
 *   2. Expenses     — paid_by / created_by ref auth.users (no cascade)
 *                     ↳ expense_splits cascade from expenses automatically
 *   3. Groups       — created_by ref auth.users (no cascade)
 *                     ↳ group_members cascade from groups automatically
 *   4. Auth users   — cascades to: profiles → friendships, friend_invites,
 *                     group_members (if any remain); push_tokens
 *
 * Usage:
 *   npm run db:remove-val-users
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

const VAL_EMAILS = ['a@val.com', 'b@val.com', 'c@val.com', 'd@val.com'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function must(label, result) {
  if (result.error) {
    console.error(`\n✗ ${label}:`);
    console.error(result.error);
    process.exit(1);
  }
  return result.data;
}

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
  console.log('🗑️   Removing validation users and all related data…\n');

  // ── Step 1: Resolve user IDs ───────────────────────────────────────────────
  console.log('🔍  Resolving validation user IDs…');

  const allUsers = await listAllUsers();
  const valUsers = allUsers.filter(u => VAL_EMAILS.includes(u.email));

  if (valUsers.length === 0) {
    console.log('  ⚠️   No validation users found — nothing to remove.\n');
    return;
  }

  const valUserIds = valUsers.map(u => u.id);

  for (const u of valUsers) {
    console.log(`  ✓  Found ${u.email}  →  ${u.id}`);
  }

  // ── Step 2: Find all groups that involve any val user ──────────────────────
  console.log('\n🔍  Finding groups involving val users…');

  const { data: memberRows, error: memberErr } = await supabase
    .from('group_members')
    .select('group_id')
    .in('user_id', valUserIds);

  if (memberErr) {
    console.error('✗ group_members lookup:', memberErr);
    process.exit(1);
  }

  const valGroupIds = [...new Set((memberRows ?? []).map(r => r.group_id))];
  console.log(`  ✓  ${valGroupIds.length} group(s) found`);

  // ── Step 3: Delete settlements ─────────────────────────────────────────────
  // Covers: group settlements in val groups + friend settlements between val users.
  // settlements.from_user_id / to_user_id reference auth.users with no cascade.
  console.log('\n💸  Deleting settlements…');

  const settlementFilter = [];

  if (valGroupIds.length > 0) {
    // Delete all settlements in val groups (regardless of who the participants are)
    const { error: e1, count: c1 } = await supabase
      .from('settlements')
      .delete({ count: 'exact' })
      .in('group_id', valGroupIds);
    if (e1) { console.error('✗ settlements (group):', e1); process.exit(1); }
    console.log(`  ✓  Deleted ${c1 ?? 0} group settlement(s)`);
  }

  // Delete friend settlements (group_id = null) involving any val user
  {
    const { error: e2, count: c2 } = await supabase
      .from('settlements')
      .delete({ count: 'exact' })
      .is('group_id', null)
      .in('from_user_id', valUserIds);
    if (e2) { console.error('✗ settlements (friend, from):', e2); process.exit(1); }
    console.log(`  ✓  Deleted ${c2 ?? 0} friend settlement(s) (as payer)`);
  }
  {
    const { error: e3, count: c3 } = await supabase
      .from('settlements')
      .delete({ count: 'exact' })
      .is('group_id', null)
      .in('to_user_id', valUserIds);
    if (e3) { console.error('✗ settlements (friend, to):', e3); process.exit(1); }
    console.log(`  ✓  Deleted ${c3 ?? 0} friend settlement(s) (as recipient)`);
  }

  // ── Step 4: Delete expenses (expense_splits cascade automatically) ─────────
  // expenses.paid_by / created_by reference auth.users with no cascade.
  console.log('\n💸  Deleting expenses (splits cascade)…');

  if (valGroupIds.length > 0) {
    // All expenses in val groups — regardless of who created them
    const { error: e1, count: c1 } = await supabase
      .from('expenses')
      .delete({ count: 'exact' })
      .in('group_id', valGroupIds);
    if (e1) { console.error('✗ expenses (group):', e1); process.exit(1); }
    console.log(`  ✓  Deleted ${c1 ?? 0} group expense(s)`);
  }

  // Friend expenses (group_id = null) involving val users.
  // Match via expense_splits: find all expense IDs where any val user has a split.
  {
    const { data: splitRows, error: splitErr } = await supabase
      .from('expense_splits')
      .select('expense_id')
      .in('user_id', valUserIds);
    if (splitErr) { console.error('✗ expense_splits lookup:', splitErr); process.exit(1); }

    const friendExpenseIds = [...new Set((splitRows ?? []).map(r => r.expense_id))];

    if (friendExpenseIds.length > 0) {
      const { error: e2, count: c2 } = await supabase
        .from('expenses')
        .delete({ count: 'exact' })
        .in('id', friendExpenseIds)
        .is('group_id', null);
      if (e2) { console.error('✗ expenses (friend):', e2); process.exit(1); }
      console.log(`  ✓  Deleted ${c2 ?? 0} friend expense(s)`);
    } else {
      console.log('  ✓  No friend expenses found');
    }
  }

  // ── Step 5: Delete groups (group_members cascade automatically) ────────────
  // groups.created_by references auth.users with no cascade — must go before users.
  if (valGroupIds.length > 0) {
    console.log('\n🏠  Deleting groups (members cascade)…');
    const { error, count } = await supabase
      .from('groups')
      .delete({ count: 'exact' })
      .in('id', valGroupIds);
    if (error) { console.error('✗ groups:', error); process.exit(1); }
    console.log(`  ✓  Deleted ${count ?? 0} group(s)`);
  }

  // ── Step 6: Delete auth users ──────────────────────────────────────────────
  // Cascades: profiles → friendships, friend_invites, group_members; push_tokens.
  console.log('\n👤  Deleting auth users…');

  for (const user of valUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`✗ deleteUser ${user.email}:`, error);
      process.exit(1);
    }
    console.log(`  ✓  Deleted ${user.email}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅  Validation data removed.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
