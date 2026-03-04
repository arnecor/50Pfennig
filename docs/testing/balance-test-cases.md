# Balance Calculation — Comprehensive Test Cases

This document describes every test scenario for the 50Pfennig balance logic.
Each case specifies the setup (users, groups, expenses, settlements) and the
**expected balances** on every screen (Home, Group Detail, Friends).

---

## How the Calculation Works

### Core Algorithm

Every balance is **derived** from two data sources: **expenses** and **settlements**.
Nothing is stored — balances are recomputed on every read.

For each **expense**:

```
balance[payer]       += totalAmount          (credit — they fronted the cash)
balance[participant] -= splitAmount          (debit — for EACH participant, including the payer)
```

For each **settlement** (person-to-person payment):

```
balance[sender]   += amount                  (credit — they paid someone back)
balance[receiver] -= amount                  (debit — they received money)
```

### Result Semantics

| Balance | Meaning |
|---------|---------|
| Positive (+) | Others owe this user money |
| Negative (−) | This user owes others money |
| Zero (0) | All settled |

### Zero-Sum Invariant

The sum of all balances in any group (or any set of friend expenses) is **always exactly 0**.

### Splitting Methods

| Type | Rule |
|------|------|
| `equal` | `allocate(total, [1,1,...,1])` — largest-remainder (Hamilton) method |
| `exact` | Each participant's amount is specified; must sum to total |
| `percentage` | Basis points (1 bp = 0.01%); must sum to 10 000; then `allocate(total, basisPoints)` |

### Expense Context

| `group_id` | Context | Balance function |
|------------|---------|------------------|
| NOT NULL | Group expense | `calculateGroupBalances(expenses, settlements, members)` |
| NULL | Friend expense | `calculateParticipantBalances(expenses, settlements)` |

### Home Screen Aggregation

The home screen shows **cross-group + cross-friend** totals:

```
youAreOwed = sum of all positive per-group/per-friend balances for current user
youOwe     = sum of all negative per-group/per-friend balances for current user
netTotal   = youAreOwed + youOwe
```

**Important:** `youAreOwed` and `youOwe` are aggregated **per context** (per group, plus one
context for all friend expenses), not per individual expense.

### Debt Simplification

`simplifyDebts(balanceMap)` reduces a balance map to the minimum set of payment
instructions. It uses a greedy algorithm: repeatedly match the largest creditor
with the largest debtor.

---

## Cast of Characters

All test cases use these users:

| Alias | UserId |
|-------|--------|
| Alice | `user-alice` |
| Bob | `user-bob` |
| Carol | `user-carol` |
| Dave | `user-dave` |
| Eve | `user-eve` |

Groups:

| Name | ID | Members |
|------|----|---------|
| WG (flat share) | `group-wg` | Alice, Bob, Carol |
| Trip | `group-trip` | Alice, Bob, Carol, Dave |
| Couple | `group-couple` | Alice, Bob |

Friendships (all accepted):

- Alice ↔ Bob
- Alice ↔ Carol
- Alice ↔ Dave
- Bob ↔ Carol
- Bob ↔ Eve

**Current user** is always **Alice** unless stated otherwise.

---

## Category 1: Single Group Expense — Equal Split

### TC-1.1 — Two people, even amount

**Setup:**
- Group: Couple (Alice, Bob)
- Expense: Alice pays €10.00 (1000¢), equal split

**Split calculation:**
`allocate(1000, [1, 1])` → `[500, 500]`

| User | Credit (paid) | Debit (split) | Net |
|------|--------------|---------------|-----|
| Alice | +1000 | −500 | **+500** |
| Bob | — | −500 | **−500** |

**Expected balances:**

| Screen | Value |
|--------|-------|
| Group "Couple" — Alice | +€5.00 (Bob owes Alice) |
| Group "Couple" — Bob | −€5.00 (Bob owes Alice) |
| Home (Alice) | youAreOwed: €5.00 · youOwe: €0.00 · net: +€5.00 |

**Simplified debts:** Bob → Alice: €5.00

---

### TC-1.2 — Three people, even amount

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense: Alice pays €30.00 (3000¢), equal split

**Split calculation:**
`allocate(3000, [1, 1, 1])` → `[1000, 1000, 1000]`

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +3000 | −1000 | **+2000** |
| Bob | — | −1000 | **−1000** |
| Carol | — | −1000 | **−1000** |

**Expected balances:**

| Screen | Value |
|--------|-------|
| Group "WG" — Alice | +€20.00 |
| Group "WG" — Bob | −€10.00 |
| Group "WG" — Carol | −€10.00 |
| Home (Alice) | youAreOwed: €20.00 · youOwe: €0.00 · net: +€20.00 |

**Simplified debts:** Bob → Alice: €10.00, Carol → Alice: €10.00

---

### TC-1.3 — Three people, amount NOT divisible by 3 (rounding)

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense: Alice pays €10.00 (1000¢), equal split

**Split calculation:**
`allocate(1000, [1, 1, 1])` → `[334, 333, 333]`

The first participant (Alice) gets the extra cent (largest-remainder method).

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +1000 | −334 | **+666** |
| Bob | — | −333 | **−333** |
| Carol | — | −333 | **−333** |

**Verification:** 666 + (−333) + (−333) = 0 ✓

**Expected balances:**

| Screen | Value |
|--------|-------|
| Group "WG" — Alice | +€6.66 |
| Group "WG" — Bob | −€3.33 |
| Group "WG" — Carol | −€3.33 |
| Home (Alice) | youAreOwed: €6.66 · youOwe: €0.00 · net: +€6.66 |

---

### TC-1.4 — Four people, 1 cent total (extreme rounding)

**Setup:**
- Group: Trip (Alice, Bob, Carol, Dave)
- Expense: Alice pays €0.01 (1¢), equal split

**Split calculation:**
`allocate(1, [1, 1, 1, 1])` → `[1, 0, 0, 0]`

Only Alice gets the 1 cent debit. All others get 0.

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +1 | −1 | **0** |
| Bob | — | 0 | **0** |
| Carol | — | 0 | **0** |
| Dave | — | 0 | **0** |

**Expected:** All balances are zero. No debts.

---

### TC-1.5 — Four people, 3 cents (remainder < participant count)

**Setup:**
- Group: Trip (Alice, Bob, Carol, Dave)
- Expense: Alice pays €0.03 (3¢), equal split

**Split calculation:**
`allocate(3, [1, 1, 1, 1])` → `[1, 1, 1, 0]`

Three participants get 1¢, the last gets 0¢.

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +3 | −1 | **+2** |
| Bob | — | −1 | **−1** |
| Carol | — | −1 | **−1** |
| Dave | — | 0 | **0** |

**Verification:** 2 + (−1) + (−1) + 0 = 0 ✓

---

### TC-1.6 — Someone else pays (not Alice)

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense: **Bob** pays €30.00 (3000¢), equal split

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | — | −1000 | **−1000** |
| Bob | +3000 | −1000 | **+2000** |
| Carol | — | −1000 | **−1000** |

**Expected balances:**

| Screen | Value |
|--------|-------|
| Group "WG" — Alice | −€10.00 |
| Group "WG" — Bob | +€20.00 |
| Group "WG" — Carol | −€10.00 |
| Home (Alice) | youAreOwed: €0.00 · youOwe: €10.00 · net: −€10.00 |

---

## Category 2: Single Group Expense — Exact Split

### TC-2.1 — Unequal exact amounts

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense: Alice pays €50.00 (5000¢), exact split:
  - Alice: 2000¢
  - Bob: 2000¢
  - Carol: 1000¢

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +5000 | −2000 | **+3000** |
| Bob | — | −2000 | **−2000** |
| Carol | — | −1000 | **−1000** |

**Expected:** Alice: +€30.00, Bob: −€20.00, Carol: −€10.00

---

### TC-2.2 — Payer owes nothing (exact split, payer amount = 0)

**Setup:**
- Group: Couple (Alice, Bob)
- Expense: Alice pays €20.00 (2000¢), exact split:
  - Alice: 0¢
  - Bob: 2000¢

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +2000 | 0 | **+2000** |
| Bob | — | −2000 | **−2000** |

This is a case where Alice paid for something entirely for Bob.

---

### TC-2.3 — Payer covers the full split (they owe themselves the total)

**Setup:**
- Group: Couple (Alice, Bob)
- Expense: Alice pays €20.00 (2000¢), exact split:
  - Alice: 2000¢
  - Bob: 0¢

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +2000 | −2000 | **0** |
| Bob | — | 0 | **0** |

**Expected:** No balance change. Alice bought something entirely for herself.

---

## Category 3: Single Group Expense — Percentage Split

### TC-3.1 — 75% / 25% split

**Setup:**
- Group: Couple (Alice, Bob)
- Expense: Alice pays €100.00 (10000¢), percentage split:
  - Alice: 7500 bp (75%)
  - Bob: 2500 bp (25%)

**Split calculation:**
`allocate(10000, [7500, 2500])` → `[7500, 2500]`

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +10000 | −7500 | **+2500** |
| Bob | — | −2500 | **−2500** |

**Expected:** Alice: +€25.00, Bob: −€25.00

---

### TC-3.2 — Three-way split with rounding (33.33% / 33.33% / 33.34%)

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense: Alice pays €100.00 (10000¢), percentage split:
  - Alice: 3333 bp
  - Bob: 3333 bp
  - Carol: 3334 bp

**Split calculation:**
`allocate(10000, [3333, 3333, 3334])` → `[3333, 3333, 3334]`

(No rounding needed here since ratios are exact to the cent.)

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +10000 | −3333 | **+6667** |
| Bob | — | −3333 | **−3333** |
| Carol | — | −3334 | **−3334** |

**Verification:** 6667 + (−3333) + (−3334) = 0 ✓

---

### TC-3.3 — Percentage split where allocate rounds

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense: Alice pays €1.00 (100¢), percentage split:
  - Alice: 3333 bp
  - Bob: 3333 bp
  - Carol: 3334 bp

**Split calculation:**
`allocate(100, [3333, 3333, 3334])` → `[33, 33, 34]`

Wait — let's be precise. Total ratio = 9999+1? No, 3333+3333+3334 = 10000.

Exact shares: 100 × 3333/10000 = 33.33, 100 × 3333/10000 = 33.33, 100 × 3334/10000 = 33.34.
Floored: [33, 33, 33]. Sum = 99. Remainder = 1.
Fractional parts: [0.33, 0.33, 0.34]. Largest = Carol (0.34).
Carol gets +1 → `[33, 33, 34]`.

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +100 | −33 | **+67** |
| Bob | — | −33 | **−33** |
| Carol | — | −34 | **−34** |

**Verification:** 67 + (−33) + (−34) = 0 ✓

---

## Category 4: Multiple Expenses in One Group

### TC-4.1 — Two expenses, same payer

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense 1: Alice pays €30.00 (3000¢), equal split → [1000, 1000, 1000]
- Expense 2: Alice pays €15.00 (1500¢), equal split → [500, 500, 500]

**After expense 1:**

| User | Net |
|------|-----|
| Alice | +2000 |
| Bob | −1000 |
| Carol | −1000 |

**After expense 2 (cumulative):**

| User | Net |
|------|-----|
| Alice | +2000 + 1000 = **+3000** |
| Bob | −1000 + (−500) = **−1500** |
| Carol | −1000 + (−500) = **−1500** |

**Expected:** Alice: +€30.00, Bob: −€15.00, Carol: −€15.00

---

### TC-4.2 — Two expenses, different payers

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense 1: Alice pays €30.00 (3000¢), equal split → [1000, 1000, 1000]
- Expense 2: Bob pays €15.00 (1500¢), equal split → [500, 500, 500]

**After expense 1:** Alice: +2000, Bob: −1000, Carol: −1000

**After expense 2:**

| User | From Exp1 | From Exp2 | Net |
|------|-----------|-----------|-----|
| Alice | +2000 | −500 | **+1500** |
| Bob | −1000 | +1000 | **0** |
| Carol | −1000 | −500 | **−1500** |

**Expected:** Alice: +€15.00, Bob: €0.00, Carol: −€15.00

**Simplified debts:** Carol → Alice: €15.00

---

### TC-4.3 — Everyone pays once, equal split (round-robin)

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense 1: Alice pays €30.00 (3000¢), equal split → [1000, 1000, 1000]
- Expense 2: Bob pays €30.00 (3000¢), equal split → [1000, 1000, 1000]
- Expense 3: Carol pays €30.00 (3000¢), equal split → [1000, 1000, 1000]

| User | Exp1 | Exp2 | Exp3 | Net |
|------|------|------|------|-----|
| Alice | +2000 | −1000 | −1000 | **0** |
| Bob | −1000 | +2000 | −1000 | **0** |
| Carol | −1000 | −1000 | +2000 | **0** |

**Expected:** All balances are zero. No debts. Everyone is settled.

---

### TC-4.4 — Mixed split types in same group

**Setup:**
- Group: WG (Alice, Bob, Carol)
- Expense 1: Alice pays €30.00 (3000¢), **equal** split → [1000, 1000, 1000]
- Expense 2: Bob pays €50.00 (5000¢), **exact** split: Alice 3000¢, Bob 1000¢, Carol 1000¢
- Expense 3: Carol pays €100.00 (10000¢), **percentage** split: Alice 5000bp, Bob 3000bp, Carol 2000bp
  → `allocate(10000, [5000, 3000, 2000])` → `[5000, 3000, 2000]`

| User | Exp1 | Exp2 | Exp3 | Net |
|------|------|------|------|-----|
| Alice | +2000 | −3000 | −5000 | **−6000** |
| Bob | −1000 | +4000 | −3000 | **0** |
| Carol | −1000 | −1000 | +8000 | **+6000** |

**Expected:** Alice: −€60.00, Bob: €0.00, Carol: +€60.00
**Simplified debts:** Alice → Carol: €60.00

---

## Category 5: Settlements

### TC-5.1 — Partial settlement

**Setup (from TC-1.2):**
- Group: WG, Expense: Alice pays €30.00 equal → Alice: +2000, Bob: −1000, Carol: −1000
- Settlement: Bob pays Alice €5.00 (500¢)

**Settlement effect:**
- Bob: +500 (credit, sent money)
- Alice: −500 (debit, received money)

| User | After Expense | After Settlement | Net |
|------|--------------|-----------------|-----|
| Alice | +2000 | −500 | **+1500** |
| Bob | −1000 | +500 | **−500** |
| Carol | −1000 | — | **−1000** |

**Verification:** 1500 + (−500) + (−1000) = 0 ✓

---

### TC-5.2 — Full settlement (balance goes to zero)

**Setup (from TC-1.2):**
- Group: WG, Expense: Alice pays €30.00 equal → Alice: +2000, Bob: −1000, Carol: −1000
- Settlement 1: Bob pays Alice €10.00 (1000¢)
- Settlement 2: Carol pays Alice €10.00 (1000¢)

| User | After Expense | After Settlements | Net |
|------|--------------|------------------|-----|
| Alice | +2000 | −1000 −1000 | **0** |
| Bob | −1000 | +1000 | **0** |
| Carol | −1000 | +1000 | **0** |

**Expected:** All balances are zero. Group is fully settled.

---

### TC-5.3 — Overpayment (settlement exceeds debt)

**Setup:**
- Group: Couple (Alice, Bob)
- Expense: Alice pays €10.00 (1000¢), equal split → Alice: +500, Bob: −500
- Settlement: Bob pays Alice €8.00 (800¢)

| User | After Expense | After Settlement | Net |
|------|--------------|-----------------|-----|
| Alice | +500 | −800 | **−300** |
| Bob | −500 | +800 | **+300** |

**Expected:** Now Alice owes Bob €3.00 (overpayment reversed the debt direction).

---

### TC-5.4 — Settlement then more expenses

**Setup:**
- Group: Couple (Alice, Bob)
- Expense 1: Alice pays €20.00 (2000¢), equal split → Alice: +1000, Bob: −1000
- Settlement: Bob pays Alice €10.00 (1000¢) → Alice: 0, Bob: 0
- Expense 2: Bob pays €8.00 (800¢), equal split → Alice: −400, Bob: +400

**Final:**

| User | Net |
|------|-----|
| Alice | +1000 − 1000 − 400 = **−400** |
| Bob | −1000 + 1000 + 400 = **+400** |

**Expected:** Alice owes Bob €4.00.

---

## Category 6: Friend Expenses (group_id = NULL)

### TC-6.1 — Simple friend expense, two people

**Setup:**
- No group — friend expense
- Expense: Alice pays €20.00 (2000¢), equal split between Alice and Bob
- `expense.groupId = null`

**Split:** `allocate(2000, [1, 1])` → `[1000, 1000]`

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +2000 | −1000 | **+1000** |
| Bob | — | −1000 | **−1000** |

Uses `calculateParticipantBalances` (not `calculateGroupBalances`).

**Expected balances:**

| Screen | Value |
|--------|-------|
| Friends — Alice's balance with Bob | +€10.00 |
| Home (Alice) | youAreOwed: €10.00 · youOwe: €0.00 · net: +€10.00 |

---

### TC-6.2 — Friend expense, three people

**Setup:**
- No group — friend expense
- Expense: Alice pays €9.00 (900¢), equal split between Alice, Bob, Carol
- `expense.groupId = null`

**Split:** `allocate(900, [1, 1, 1])` → `[300, 300, 300]`

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +900 | −300 | **+600** |
| Bob | — | −300 | **−300** |
| Carol | — | −300 | **−300** |

**Expected:** Alice: +€6.00, Bob: −€3.00, Carol: −€3.00

---

### TC-6.3 — Friend pays Alice

**Setup:**
- No group — friend expense
- Expense: **Bob** pays €20.00 (2000¢), equal split between Alice and Bob
- `expense.groupId = null`

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | — | −1000 | **−1000** |
| Bob | +2000 | −1000 | **+1000** |

**Expected:**

| Screen | Value |
|--------|-------|
| Home (Alice) | youAreOwed: €0.00 · youOwe: €10.00 · net: −€10.00 |

---

### TC-6.4 — Multiple friend expenses with different people

**Setup:**
- Friend expense 1: Alice pays €10.00 (1000¢), equal with Bob → Alice +500, Bob −500
- Friend expense 2: Alice pays €20.00 (2000¢), equal with Carol → Alice +1000, Carol −1000
- Friend expense 3: Carol pays €6.00 (600¢), equal with Alice → Alice −300, Carol +300

All expenses have `groupId = null`. All go into one `calculateParticipantBalances` call.

**Cumulative:**

| User | Exp1 | Exp2 | Exp3 | Net |
|------|------|------|------|-----|
| Alice | +500 | +1000 | −300 | **+1200** |
| Bob | −500 | — | — | **−500** |
| Carol | — | −1000 | +300 | **−700** |

**Expected:**

| Screen | Value |
|--------|-------|
| Home (Alice) | youAreOwed: €12.00 · youOwe: €0.00 · net: +€12.00 |

**Note:** Friend expenses are aggregated into a **single** balance context on the
home screen. Alice's friend balance is +€12.00 (one positive number), not split
per friend.

---

## Category 7: Cross-Context — Group + Friend Expenses Combined

### TC-7.1 — One group expense + one friend expense (both positive for Alice)

**Setup:**
- Group WG: Alice pays €30.00 equal (Alice, Bob, Carol)
  → Alice: +2000 in group context
- Friend expense: Alice pays €10.00 equal (Alice, Dave)
  → Alice: +500 in friend context

**Home screen (Alice):**

| Source | Alice's balance |
|--------|----------------|
| Group WG | +2000 |
| Friend expenses | +500 |

**youAreOwed** = 2000 + 500 = **2500** (€25.00)
**youOwe** = **0**
**netTotal** = +€25.00

---

### TC-7.2 — Owed in one group, owing in another

**Setup:**
- Group WG: Alice pays €30.00 equal (Alice, Bob, Carol)
  → Alice: +2000 in WG
- Group Trip: **Dave** pays €40.00 equal (Alice, Bob, Carol, Dave)
  → `allocate(4000, [1,1,1,1])` → `[1000, 1000, 1000, 1000]`
  → Alice: −1000 in Trip

**Home screen (Alice):**

| Source | Alice's balance |
|--------|----------------|
| Group WG | +2000 (positive → goes to youAreOwed) |
| Group Trip | −1000 (negative → goes to youOwe) |

**youAreOwed** = **2000** (€20.00)
**youOwe** = **−1000** (€10.00)
**netTotal** = 2000 + (−1000) = **+1000** (€10.00)

**Important:** youAreOwed and youOwe are NOT netted — they show the gross amounts
from each context separately. A user who is owed €20 in one group and owes €10
in another sees both numbers, plus the net.

---

### TC-7.3 — Group + friend, mixed directions

**Setup:**
- Group Couple: Bob pays €20.00 equal (Alice, Bob)
  → Alice: −1000 in Couple
- Friend expense: Alice pays €6.00 equal (Alice, Carol)
  → Alice: +300 in friend context

**Home screen (Alice):**

| Source | Alice's balance |
|--------|----------------|
| Group Couple | −1000 (→ youOwe) |
| Friend expenses | +300 (→ youAreOwed) |

**youAreOwed** = **300** (€3.00)
**youOwe** = **−1000** (€10.00)
**netTotal** = 300 + (−1000) = **−700** (−€7.00)

---

### TC-7.4 — Multiple groups + friend expenses

**Setup:**
- Group WG: Alice pays €30.00 equal (Alice, Bob, Carol) → Alice: +2000
- Group Couple: Bob pays €10.00 equal (Alice, Bob) → Alice: −500
- Group Trip: Alice pays €80.00 equal (Alice, Bob, Carol, Dave) → `allocate(8000, [1,1,1,1])` = [2000, 2000, 2000, 2000] → Alice: +6000
- Friend expense: Dave pays €20.00 equal (Alice, Dave) → Alice: −1000

**Home screen (Alice):**

| Source | Alice's balance | Bucket |
|--------|----------------|--------|
| Group WG | +2000 | youAreOwed |
| Group Couple | −500 | youOwe |
| Group Trip | +6000 | youAreOwed |
| Friend expenses | −1000 | youOwe |

**youAreOwed** = 2000 + 6000 = **8000** (€80.00)
**youOwe** = (−500) + (−1000) = **−1500** (€15.00)
**netTotal** = 8000 + (−1500) = **+6500** (€65.00)

---

## Category 8: Debt Simplification

### TC-8.1 — Simple two-person debt

**Input balanceMap:** Alice: +500, Bob: −500

**Simplified:** Bob → Alice: €5.00

---

### TC-8.2 — Three-person, one creditor

**Input:** Alice: +2000, Bob: −1000, Carol: −1000

**Simplified:**
1. Bob → Alice: €10.00
2. Carol → Alice: €10.00

(2 transactions)

---

### TC-8.3 — Three-person, two creditors

**Input:** Alice: +1500, Bob: +500, Carol: −2000

**Simplified:**
1. Carol → Alice: €15.00 (largest creditor matched first)
2. Carol → Bob: €5.00

(2 transactions)

---

### TC-8.4 — Four-person chain

**Input:** Alice: +3000, Bob: +1000, Carol: −2000, Dave: −2000

**Simplified:**
1. Carol → Alice: €20.00 (Carol fully settled)
2. Dave → Alice: €10.00 (Alice fully settled)
3. Dave → Bob: €10.00 (Bob fully settled, Dave fully settled)

(3 transactions)

---

### TC-8.5 — All zero balances

**Input:** Alice: 0, Bob: 0, Carol: 0

**Simplified:** empty array (no transactions needed)

---

### TC-8.6 — Already balanced single non-zero pair

**Input:** Alice: +700, Bob: −700, Carol: 0

**Simplified:** Bob → Alice: €7.00

---

## Category 9: Edge Cases & Invariants

### TC-9.1 — Zero-amount expense

**Setup:**
- Group: Couple (Alice, Bob)
- Expense: Alice pays €0.00 (0¢), equal split

**Split:** `allocate(0, [1, 1])` → `[0, 0]`

**Expected:** All balances remain at zero.

---

### TC-9.2 — Single participant (payer = only participant)

**Setup:**
- Group: Couple (Alice, Bob)
- Expense: Alice pays €50.00 (5000¢), equal split, but only Alice in participants list

**Split:** `allocate(5000, [1])` → `[5000]`

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +5000 | −5000 | **0** |
| Bob | — | — | **0** |

Alice paid for herself — no balance change for anyone.

---

### TC-9.3 — Large amount with 4-way equal split

**Setup:**
- Group: Trip (Alice, Bob, Carol, Dave)
- Expense: Alice pays €1,000.01 (100001¢), equal split

**Split:** `allocate(100001, [1, 1, 1, 1])`
- Exact shares: 25000.25 each
- Floored: [25000, 25000, 25000, 25000]. Sum = 100000. Remainder = 1.
- Largest fractional: all equal (0.25). First in sort order gets +1.
- Result: `[25001, 25000, 25000, 25000]`

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Alice | +100001 | −25001 | **+75000** |
| Bob | — | −25000 | **−25000** |
| Carol | — | −25000 | **−25000** |
| Dave | — | −25000 | **−25000** |

**Verification:** 75000 + (−25000) × 3 = 0 ✓

---

### TC-9.4 — Non-member payer in calculateGroupBalances

**Setup:**
- Group WG members: Alice, Bob, Carol
- Expense: **Dave** pays €30.00 (3000¢), equal split among Alice, Bob, Carol

Dave is not a group member, so his balance is not initialised to 0 by the member
loop. However, `adjust()` uses `?? ZERO` so it still works.

| User | Credit | Debit | Net |
|------|--------|-------|-----|
| Dave | +3000 | — | **+3000** |
| Alice | — | −1000 | **−1000** |
| Bob | — | −1000 | **−1000** |
| Carol | — | −1000 | **−1000** |

**Note:** Dave would appear in the balance map even though he is not in the members array.
This is an edge case — in practice, the UI only adds expenses for actual members.

---

### TC-9.5 — Empty group (no expenses, no settlements)

**Setup:**
- Group: WG (Alice, Bob, Carol)
- No expenses, no settlements

**Expected:** All members have balance 0. Simplified debts: empty array.

---

### TC-9.6 — Settlement without prior expense

**Setup:**
- Group: Couple (Alice, Bob)
- No expenses
- Settlement: Bob pays Alice €10.00 (1000¢)

| User | Net |
|------|-----|
| Alice | −1000 (received → debited) |
| Bob | +1000 (sent → credited) |

**Expected:** Alice: −€10.00, Bob: +€10.00.
This is legal — a settlement is just a transfer, it doesn't require a prior expense.

---

## Category 10: Complex Real-World Scenarios

### TC-10.1 — Shared flat monthly scenario

**Setup:**
- Group: WG (Alice, Bob, Carol)

Expenses:
1. Alice pays rent €900.00 (90000¢), equal split → [30000, 30000, 30000]
2. Bob pays groceries €45.00 (4500¢), equal split → [1500, 1500, 1500]
3. Carol pays internet €30.00 (3000¢), equal split → [1000, 1000, 1000]
4. Alice pays dinner €27.50 (2750¢), equal split → `allocate(2750, [1,1,1])` → [917, 917, 916]

| User | Exp1 | Exp2 | Exp3 | Exp4 | Net |
|------|------|------|------|------|-----|
| Alice | +60000 | −1500 | −1000 | +1833 | **+59333** |
| Bob | −30000 | +3000 | −1000 | −917 | **−28917** |
| Carol | −30000 | −1500 | +2000 | −916 | **−30416** |

**Verification:** 59333 + (−28917) + (−30416) = 0 ✓

**Simplified debts:**
1. Carol → Alice: €304.16
2. Bob → Alice: €289.17

**Home (Alice):** youAreOwed: €593.33, youOwe: €0.00, net: +€593.33

---

### TC-10.2 — Trip with mixed payment and settlement

**Setup:**
- Group: Trip (Alice, Bob, Carol, Dave)

Expenses:
1. Alice pays hotel €200.00 (20000¢), equal split → [5000, 5000, 5000, 5000]
2. Bob pays restaurant €80.00 (8000¢), equal split → [2000, 2000, 2000, 2000]
3. Carol pays taxi €13.00 (1300¢), equal split → `allocate(1300, [1,1,1,1])` → [325, 325, 325, 325]
4. Dave pays tickets €60.00 (6000¢), equal split → [1500, 1500, 1500, 1500]

| User | Exp1 | Exp2 | Exp3 | Exp4 | Net |
|------|------|------|------|------|-----|
| Alice | +15000 | −2000 | −325 | −1500 | **+11175** |
| Bob | −5000 | +6000 | −325 | −1500 | **−825** |
| Carol | −5000 | −2000 | +975 | −1500 | **−7525** |
| Dave | −5000 | −2000 | −325 | +4500 | **−2825** |

**Verification:** 11175 + (−825) + (−7525) + (−2825) = 0 ✓

Now add settlements:
- Settlement 1: Bob pays Alice €8.25 (825¢)
- Settlement 2: Dave pays Alice €28.25 (2825¢)

| User | Before | Settlement adjustments | Net |
|------|--------|----------------------|-----|
| Alice | +11175 | −825 −2825 | **+7525** |
| Bob | −825 | +825 | **0** |
| Carol | −7525 | — | **−7525** |
| Dave | −2825 | +2825 | **0** |

**After partial settlements — Simplified debts:**
Carol → Alice: €75.25

---

### TC-10.3 — Alice in two groups + friend expenses simultaneously

**Setup:**
- Group WG (Alice, Bob, Carol):
  - Alice pays €30.00 equal → Alice: +2000
- Group Couple (Alice, Bob):
  - Bob pays €50.00 equal → Alice: −2500
- Friend expenses (groupId = null):
  - Alice pays €12.00 equal with Dave → Alice: +600
  - Eve pays €8.00 equal with Alice → Alice: −400 (note: Eve is not Alice's friend in our cast, but this tests the calculation)

**Balances by context:**

| Context | Alice's balance |
|---------|----------------|
| Group WG | +2000 |
| Group Couple | −2500 |
| Friend expenses (all) | +600 + (−400) = +200 |

**Home screen (Alice):**
- youAreOwed = 2000 (WG) + 200 (friends) = **2200** (€22.00)
- youOwe = −2500 (Couple) = **−2500** (€25.00)
- netTotal = 2200 + (−2500) = **−300** (−€3.00)

---

### TC-10.4 — Same two users in a group AND as friends

**Setup:**
- Group Couple (Alice, Bob):
  - Alice pays €20.00 equal → Alice: +1000 in group
- Friend expense (groupId = null):
  - Bob pays €10.00 equal (Alice, Bob) → Alice: −500 in friend context

These are **separate contexts**. The group expense only affects the group balance;
the friend expense only affects the friend balance.

**Home screen (Alice):**
- youAreOwed = 1000 (from Couple group) = **€10.00**
- youOwe = −500 (from friend expenses) = **€5.00**
- netTotal = 1000 + (−500) = **+500** (€5.00)

**Note:** Even though Alice and Bob appear in both contexts, the balances are
computed independently. There is no cross-context netting.

---

### TC-10.5 — Long chain of expenses and settlements

**Setup:**
- Group: WG (Alice, Bob, Carol)

1. Alice pays €60.00 equal → [2000, 2000, 2000]. Alice: +4000, Bob: −2000, Carol: −2000
2. Bob settles with Alice: €10.00. Alice: +3000, Bob: −1000, Carol: −2000
3. Carol pays €30.00 equal → [1000, 1000, 1000]. Alice: +2000, Bob: −2000, Carol: 0
4. Bob pays €15.00 equal → [500, 500, 500]. Alice: +1500, Bob: −1000, Carol: −500
5. Carol settles with Alice: €15.00. Alice: 0, Bob: −1000, Carol: +1000

Wait, let me recalculate step by step.

**Step 1 — Expense: Alice pays €60.00 equal:**

| User | Net |
|------|-----|
| Alice | +4000 |
| Bob | −2000 |
| Carol | −2000 |

**Step 2 — Settlement: Bob → Alice €10.00 (1000¢):**

| User | Net |
|------|-----|
| Alice | 4000 − 1000 = +3000 |
| Bob | −2000 + 1000 = −1000 |
| Carol | −2000 |

**Step 3 — Expense: Carol pays €30.00 equal:**

| User | Net |
|------|-----|
| Alice | 3000 − 1000 = +2000 |
| Bob | −1000 − 1000 = −2000 |
| Carol | −2000 + 2000 = 0 |

**Step 4 — Expense: Bob pays €15.00 equal:**

| User | Net |
|------|-----|
| Alice | 2000 − 500 = +1500 |
| Bob | −2000 + 1000 = −1000 |
| Carol | 0 − 500 = −500 |

**Step 5 — Settlement: Carol → Alice €15.00 (1500¢):**

| User | Net |
|------|-----|
| Alice | 1500 − 1500 = **0** |
| Bob | **−1000** |
| Carol | −500 + 1500 = **+1000** |

**Verification:** 0 + (−1000) + 1000 = 0 ✓

**Final simplified debts:** Bob → Carol: €10.00

---

## Category 11: Perspective-Dependent Display

All previous cases assume Alice is the current user. These cases test what
**different users** see on their Home screen.

### TC-11.1 — Bob's home screen perspective

**Setup (same as TC-7.4):**
- Group WG (Alice, Bob, Carol): Alice pays €30 equal → Bob: −1000
- Group Couple (Alice, Bob): Bob pays €10 equal → Bob: +500
- Group Trip (Alice, Bob, Carol, Dave): Alice pays €80 equal → Bob: −2000
- Friend expense: Dave pays €20 equal (Alice, Dave) — Bob is NOT a participant

**Bob's balances by context:**

| Context | Bob's balance |
|---------|--------------|
| Group WG | −1000 |
| Group Couple | +500 |
| Group Trip | −2000 |
| Friend expenses | 0 (Bob has no friend expenses) |

**Home (Bob):**
- youAreOwed = 500 (Couple) = **€5.00**
- youOwe = (−1000) + (−2000) = **−3000** (€30.00)
- netTotal = 500 + (−3000) = **−2500** (−€25.00)

---

## Category 12: allocate() Edge Cases

These test the Hamilton/largest-remainder method directly.

### TC-12.1 — allocate(100, [1,1,1]) — classic three-way

Result: `[34, 33, 33]`. Sum = 100 ✓.
First participant gets the extra cent.

### TC-12.2 — allocate(1, [1,1,1]) — 1 cent among 3

Result: `[1, 0, 0]`. Sum = 1 ✓.

### TC-12.3 — allocate(7, [1,1,1]) — 7 cents among 3

Exact: 2.333... each. Floor: [2,2,2] = 6. Remainder = 1.
All fractional parts equal (0.333). First gets +1.
Result: `[3, 2, 2]`. Sum = 7 ✓.

### TC-12.4 — allocate(1001, [1,1,1,1]) — 4-way uneven

Exact: 250.25 each. Floor: [250,250,250,250] = 1000. Remainder = 1.
All fractional parts equal (0.25). First gets +1.
Result: `[251, 250, 250, 250]`. Sum = 1001 ✓.

### TC-12.5 — allocate(100, [70, 20, 10]) — weighted

Exact: 70, 20, 10. No remainder.
Result: `[70, 20, 10]`. Sum = 100 ✓.

### TC-12.6 — allocate(10, [1, 1, 1, 1, 1, 1, 1]) — 7-way

Exact: 1.4286 each. Floor: [1,1,1,1,1,1,1] = 7. Remainder = 3.
Fractional: all 0.4286. First 3 get +1.
Result: `[2, 2, 2, 1, 1, 1, 1]`. Sum = 10 ✓.

### TC-12.7 — allocate(0, [1,1,1]) — zero amount

Exact: 0, 0, 0. Floor: [0,0,0]. Remainder = 0.
Result: `[0, 0, 0]`. Sum = 0 ✓.

---

## Category 13: Validation Errors

These test that the system correctly rejects invalid input.

### TC-13.1 — Exact split amounts don't sum to total

**Input:** total = 1000¢, exact amounts: Alice 600¢ + Bob 300¢ = 900¢

**Expected:** Error: "Exact split amounts sum to 900 cents but total is 1000 cents"

### TC-13.2 — Percentage basis points don't sum to 10000

**Input:** basisPoints: Alice 5000 + Bob 4000 = 9000

**Expected:** Error: "Percentage split basis points sum to 9000 but must equal 10000"

### TC-13.3 — Zero participants

**Input:** participants = []

**Expected:** Error: "Cannot split an expense among zero participants"

### TC-13.4 — Exact split missing a participant

**Input:** participants = [Alice, Bob], exact amounts: only Alice specified

**Expected:** Error: "Exact split is missing an amount for participant \"user-bob\""

### TC-13.5 — allocate() with zero ratios

**Input:** `allocate(100, [0, 0, 0])`

**Expected:** Error: "Ratios must not all be zero"

### TC-13.6 — allocate() with empty ratios

**Input:** `allocate(100, [])`

**Expected:** Error: "Cannot allocate to zero parts"

### TC-13.7 — Money constructed with non-integer

**Input:** `money(10.5)`

**Expected:** Error: "Money must be an integer number of cents, got 10.5"

---

## Quick Reference: Screen Mapping

| Screen | Data source | Calculation |
|--------|-------------|-------------|
| **Home** — youAreOwed / youOwe | All groups + friend expenses | Sum of positive / negative per-context balances for current user |
| **Group detail** — member balances | Expenses + settlements for that group | `calculateGroupBalances(expenses, settlements, members)` |
| **Group detail** — simplified debts | Same balance map | `simplifyDebts(balanceMap)` |
| **Friends** (future) — balance with friend X | Friend expenses involving current user + friend X | `calculateParticipantBalances(sharedExpenses, sharedSettlements)` |

---

## Summary of Invariants to Verify

1. **Split sum:** `sum(splitAmounts) === totalAmount` — always, for every split type
2. **Basis points sum:** `sum(basisPoints) === 10000` — for every percentage split
3. **Zero-sum:** `sum(allBalances) === 0` — for every group and every friend context
4. **No balance drift:** Adding and then fully settling an expense returns all balances to their prior state
5. **Commutativity:** The order of expenses within a context does not affect final balances
6. **Context isolation:** Group expenses and friend expenses are computed independently; a group expense never affects the friend balance and vice versa
7. **Settlement symmetry:** A settlement of amount X credits the sender by X and debits the receiver by X
8. **Idempotent derivation:** Calling the balance function multiple times with the same inputs always returns the same result
