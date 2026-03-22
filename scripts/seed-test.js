#!/usr/bin/env node
if (process.env.VITE_APP_ENV === 'production') {
  console.error('ERROR: Seed scripts cannot run against production. Use a dev or local environment.');
  process.exit(1);
}
/**
 * scripts/seed-test.js
 *
 * Creates a focused, deterministic test dataset for the 50Pfennig development database:
 *   - 5 fixed users (a@test.com … e@test.com / 123456)
 *   - All 10 possible friendships between them (fully connected)
 *   - 1 group "Wanderurlaub Alpen" with all 5 users as members
 *   - 5 group expenses — each user pays exactly one (equal split among all members)
 *
 * Usage:
 *   npm run db:seed-test
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from .env.local automatically.
 * Get the service key from `npm run db:status` → Secret.
 *
 * All users share the password: 123456
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

/** Exits with an error message if the Supabase call failed. */
function must(label, result) {
  if (result.error) {
    console.error(`\n✗ ${label}:`);
    console.error(result.error);
    process.exit(1);
  }
  return result.data;
}

/**
 * Split totalAmount (integer cents) equally among all userIds.
 * Remaining pennies go to the first N users.
 * Invariant: sum of amounts === totalAmount.
 */
function equalSplits(totalAmount, userIds) {
  const n = userIds.length;
  const base = Math.floor(totalAmount / n);
  const remainder = totalAmount % n;
  return userIds.map((user_id, i) => ({
    user_id,
    amount: base + (i < remainder ? 1 : 0),
  }));
}

// ── Fixed seed data ───────────────────────────────────────────────────────────

// 5 fixed users — names never change between runs.
const USER_DEFS = [
  { email: 'a@test.com', displayName: 'Lena' },
  { email: 'b@test.com', displayName: 'Max' },
  { email: 'c@test.com', displayName: 'Sophie' },
  { email: 'd@test.com', displayName: 'Felix' },
  { email: 'e@test.com', displayName: 'Nina' },
];

// One expense per user — amounts are fixed (in cents).
// paidByIndex refers to the index in USER_DEFS / users array.
const EXPENSE_DEFS = [
  { description: 'Hüttenmiete', totalAmount: 15000, paidByIndex: 0 },       // Lena:  150,00 €
  { description: 'Lebensmittel Einkauf', totalAmount: 8750, paidByIndex: 1 }, // Max:    87,50 €
  { description: 'Benzin Hinfahrt', totalAmount: 6200, paidByIndex: 2 },     // Sophie: 62,00 €
  { description: 'Wanderausrüstung', totalAmount: 4500, paidByIndex: 3 },    // Felix:  45,00 €
  { description: 'Abendessen Berghütte', totalAmount: 11300, paidByIndex: 4 }, // Nina: 113,00 €
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Seeding 50Pfennig test database…\n');

  // ── Step 1: Create 5 fixed users ─────────────────────────────────────────
  console.log('👤  Creating 5 test users…');
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

  // ── Step 2: Create all-pairs friendships (fully connected) ────────────────
  console.log('\n🤝  Creating friendships (all pairs)…');

  for (let a = 0; a < users.length; a++) {
    for (let b = a + 1; b < users.length; b++) {
      must(
        `friendship ${USER_DEFS[a].displayName} ↔ ${USER_DEFS[b].displayName}`,
        await supabase.from('friendships').insert({
          requester_id: users[a].id,
          addressee_id: users[b].id,
          status: 'accepted',
        }),
      );
      console.log(`  ✓  ${USER_DEFS[a].displayName} ↔ ${USER_DEFS[b].displayName}`);
    }
  }

  // ── Step 3: Create group with all 5 members ───────────────────────────────
  console.log('\n🏔️  Creating group "Wanderurlaub Alpen"…');

  const group = must(
    'createGroup "Wanderurlaub Alpen"',
    await supabase
      .from('groups')
      .insert({ name: 'Wanderurlaub Alpen', created_by: users[0].id })
      .select()
      .single(),
  );

  must(
    'addMembers "Wanderurlaub Alpen"',
    await supabase.from('group_members').insert(
      users.map(u => ({ group_id: group.id, user_id: u.id })),
    ),
  );

  console.log(`  ✓  "Wanderurlaub Alpen" created with ${users.length} members`);

  // ── Step 4: Create one expense per user (equal split among all 5) ─────────
  console.log('\n💸  Creating group expenses…');

  const allUserIds = users.map(u => u.id);

  for (const def of EXPENSE_DEFS) {
    const paidBy = users[def.paidByIndex].id;
    const splits = equalSplits(def.totalAmount, allUserIds);

    const splitSum = splits.reduce((s, r) => s + r.amount, 0);
    if (splitSum !== def.totalAmount) {
      console.error(`  ✗  Split sum mismatch for "${def.description}": ${splitSum} !== ${def.totalAmount}`);
      process.exit(1);
    }

    const expense = must(
      `createExpense "${def.description}"`,
      await supabase
        .from('expenses')
        .insert({
          group_id:     group.id,
          description:  def.description,
          total_amount: def.totalAmount,
          paid_by:      paidBy,
          split_type:   'equal',
          split_config: { type: 'equal' },
          created_by:   paidBy,
        })
        .select()
        .single(),
    );

    must(
      `insertSplits "${def.description}"`,
      await supabase.from('expense_splits').insert(
        splits.map(s => ({ expense_id: expense.id, user_id: s.user_id, amount: s.amount })),
      ),
    );

    const euros = (def.totalAmount / 100).toFixed(2);
    const paidByName = USER_DEFS[def.paidByIndex].displayName;
    console.log(`  ✓  "${def.description}"  ${euros} €  [paid by ${paidByName}]`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅  Test seed complete!\n');
  console.log('   Users:       a@test.com (Lena), b@test.com (Max), c@test.com (Sophie),');
  console.log('                d@test.com (Felix), e@test.com (Nina)  /  all: 123456');
  console.log('   Group:       Wanderurlaub Alpen (5 members)');
  console.log('   Friendships: all 10 pairs (fully connected)');
  console.log('   Expenses:    5 × equal split — one per user\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
