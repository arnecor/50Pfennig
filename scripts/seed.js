#!/usr/bin/env node
/**
 * scripts/seed.js
 *
 * Creates test data for the 50Pfennig development database:
 *   - 10 test users (profiles auto-created via trigger)
 *   - 3 groups with max 4 members each (some users appear in multiple groups)
 *   - At least 3 expenses per group with equal / exact / percentage splits
 *
 * Usage:
 *   npm run db:seed
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from .env.local automatically.
 * Get the service key from `npm run db:status` → Secret.
 *
 * All random test users share the password: password123
 */

import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker/locale/de';

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
 * Remaining pennies (from integer division) go to the first N users.
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

/**
 * Split totalAmount into random exact amounts that each are >= 1 cent.
 * Invariant: sum of amounts === totalAmount.
 */
function exactSplits(totalAmount, userIds) {
  const n = userIds.length;
  // Reserve 1 cent per person, then distribute the pool randomly.
  const pool = totalAmount - n;
  const cuts = Array.from({ length: n - 1 }, () =>
    Math.floor(Math.random() * (pool + 1)),
  ).sort((a, b) => a - b);

  const amounts = [];
  let prev = 0;
  for (const cut of cuts) {
    amounts.push(cut - prev + 1);
    prev = cut;
  }
  amounts.push(pool - prev + 1);

  return userIds.map((user_id, i) => ({ user_id, amount: amounts[i] }));
}

/**
 * Split totalAmount by even percentage shares (basis points, 1 bp = 0.01%).
 * Basis points sum to exactly 10000. Rounding error goes to the first person.
 * Invariant: sum of amounts === totalAmount.
 */
function percentageSplits(totalAmount, userIds) {
  const n = userIds.length;
  const baseBp = Math.floor(10000 / n);
  const bpRemainder = 10000 % n;
  const bps = userIds.map((_, i) => baseBp + (i < bpRemainder ? 1 : 0));

  const amounts = bps.map(bp => Math.floor((totalAmount * bp) / 10000));
  const diff = totalAmount - amounts.reduce((s, a) => s + a, 0);
  amounts[0] += diff; // correct rounding error

  const basisPoints = Object.fromEntries(userIds.map((uid, i) => [uid, bps[i]]));

  return {
    config: { type: 'percentage', basisPoints },
    splits: userIds.map((user_id, i) => ({ user_id, amount: amounts[i] })),
  };
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const GROUP_DEFS = [
  {
    name: 'WG Sonnenallee',
    // users 0, 1, 2, 3
    memberIndices: [0, 1, 2, 3],
    expenses: [
      { description: 'Supermarkt Wocheneinkauf', min: 3000, max: 12000 },
      { description: 'Stromrechnung Oktober', min: 5000, max: 15000 },
      { description: 'Waschmittel & Reiniger', min: 800, max: 2500 },
      { description: 'Internetrechnung', min: 2999, max: 4999 },
    ],
  },
  {
    name: 'Campingtrip Ostsee',
    // users 2, 4, 5, 6  →  user 2 overlaps with group 0
    memberIndices: [2, 4, 5, 6],
    expenses: [
      { description: 'Campingplatz Gebühr', min: 8000, max: 20000 },
      { description: 'Lebensmittel fürs Wochenende', min: 4000, max: 10000 },
      { description: 'Benzin Hin- und Rückfahrt', min: 6000, max: 14000 },
      { description: 'Grillkohle & Anzünder', min: 500, max: 1500 },
      { description: 'Getränkevorrat', min: 2000, max: 5000 },
    ],
  },
  {
    name: 'Büro Mittagessen',
    // users 0, 7, 8, 9  →  user 0 overlaps with group 0
    memberIndices: [0, 7, 8, 9],
    expenses: [
      { description: 'Italiener vom Donnerstag', min: 4500, max: 8000 },
      { description: 'Sushi-Lieferung Freitag', min: 6000, max: 12000 },
      { description: 'Döner für alle', min: 3000, max: 6000 },
    ],
  },
];

// Rotate through split types so every type appears at least once per group.
const SPLIT_CYCLE = ['equal', 'percentage', 'exact', 'equal'];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Seeding 50Pfennig development database…\n');

  // ── Step 1a: Create fixed personal user ───────────────────────────────────
  console.log('👤  Creating fixed user…');
  const arneData = must(
    'createUser arne@arne.de',
    await supabase.auth.admin.createUser({
      email: 'arne@arne.de',
      password: '123456',
      email_confirm: true,
      user_metadata: { display_name: 'Arne Original' },
    }),
  );
  const arneUser = arneData.user;
  console.log(`  ✓  arne@arne.de  →  Arne`);

  // ── Step 1b: Create 10 random test users ──────────────────────────────────
  console.log('👤  Creating 10 test users…');
  // arneUser is prepended so he appears in every group (index 0 is always a member).
  const users = [arneUser];

  for (let i = 0; i < 10; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = `testuser${i + 1}@test.example.com`;

    const data = must(
      `createUser ${email}`,
      await supabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true,
        user_metadata: { display_name: `${firstName} ${lastName}` },
      }),
    );

    users.push(data.user);
    console.log(`  ✓  ${email}  →  ${firstName} ${lastName}`);
  }

  // ── Step 2 + 3: Create groups and add members ─────────────────────────────
  console.log('\n🏠  Creating 3 groups…');
  const groups = [];

  for (const groupDef of GROUP_DEFS) {
    const { memberIndices, name } = groupDef;
    const creatorId = users[memberIndices[0]].id;

    const group = must(
      `createGroup "${name}"`,
      await supabase
        .from('groups')
        .insert({ name, created_by: creatorId })
        .select()
        .single(),
    );

    groups.push(group);
    console.log(`  ✓  "${name}"  (${memberIndices.length} members)`);

    // Add members — group_members.user_id FK now references profiles.id,
    // which has the same UUID as auth.users.id (see migration 0002).
    const memberRows = memberIndices.map(i => ({
      group_id: group.id,
      user_id: users[i].id,
    }));

    must(
      `addMembers "${name}"`,
      await supabase.from('group_members').insert(memberRows),
    );
  }

  // ── Step 4: Create expenses + splits per group ────────────────────────────
  console.log('\n💸  Creating expenses…');

  for (let g = 0; g < GROUP_DEFS.length; g++) {
    const groupDef = GROUP_DEFS[g];
    const group = groups[g];
    const memberIds = groupDef.memberIndices.map(i => users[i].id);

    console.log(`\n  Group: "${group.name}"`);

    for (let e = 0; e < groupDef.expenses.length; e++) {
      const expDef = groupDef.expenses[e];
      const totalAmount = faker.number.int({ min: expDef.min, max: expDef.max });
      const paidBy = faker.helpers.arrayElement(memberIds);
      const splitType = SPLIT_CYCLE[e % SPLIT_CYCLE.length];

      let splits;
      let splitConfig;

      if (splitType === 'equal') {
        splits = equalSplits(totalAmount, memberIds);
        splitConfig = { type: 'equal' };
      } else if (splitType === 'exact') {
        splits = exactSplits(totalAmount, memberIds);
        splitConfig = {
          type: 'exact',
          amounts: Object.fromEntries(splits.map(s => [s.user_id, s.amount])),
        };
      } else {
        // percentage
        const pct = percentageSplits(totalAmount, memberIds);
        splits = pct.splits;
        splitConfig = pct.config;
      }

      // Sanity check: splits must sum exactly to totalAmount
      const splitSum = splits.reduce((s, r) => s + r.amount, 0);
      if (splitSum !== totalAmount) {
        console.error(
          `  ✗  Split sum mismatch for "${expDef.description}": ${splitSum} !== ${totalAmount}`,
        );
        process.exit(1);
      }

      const expense = must(
        `createExpense "${expDef.description}"`,
        await supabase
          .from('expenses')
          .insert({
            group_id: group.id,
            description: expDef.description,
            total_amount: totalAmount,
            paid_by: paidBy,
            split_type: splitType,
            split_config: splitConfig,
            created_by: paidBy,
          })
          .select()
          .single(),
      );

      must(
        `insertSplits "${expDef.description}"`,
        await supabase.from('expense_splits').insert(
          splits.map(s => ({ expense_id: expense.id, user_id: s.user_id, amount: s.amount })),
        ),
      );

      const euros = (totalAmount / 100).toFixed(2);
      console.log(`    ✓  "${expDef.description}"  ${euros} €  [${splitType}]`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅  Seed complete!\n');
  console.log('   Fixed:    arne@arne.de  /  123456  (WG Sonnenallee + Büro Mittagessen)');
  console.log('   Random:   testuser1@test.example.com … testuser10@test.example.com  /  password123');
  console.log('   Groups:   WG Sonnenallee, Campingtrip Ostsee, Büro Mittagessen\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
