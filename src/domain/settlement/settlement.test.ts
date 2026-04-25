import { describe, expect, it } from 'vitest';
import { ZERO, money } from '../types';
import type { GroupId, UserId } from '../types';
import { type ContextDebt, allocateSettlement } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uid = (s: string) => s as UserId;
const gid = (s: string) => s as GroupId;

const anna = uid('anna');
const me = uid('me');

const groupX = gid('group-x');
const groupY = gid('group-y');

// ---------------------------------------------------------------------------
// allocateSettlement
// ---------------------------------------------------------------------------

describe('allocateSettlement', () => {
  it('single context: full payment to one group', () => {
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(1500) }, // anna owes me €15 in group X
    ];

    const result = allocateSettlement(money(1500), anna, me, debts);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      groupId: groupX,
      fromUserId: anna,
      toUserId: me,
      amount: money(1500),
    });
  });

  it('two contexts: allocates across group + direct', () => {
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(1500) }, // anna owes me €15 in group X
      { groupId: null, amount: money(500) }, // anna owes me €5 direct
    ];

    const result = allocateSettlement(money(2000), anna, me, debts);

    expect(result).toHaveLength(2);

    const groupAlloc = result.find((a) => a.groupId === groupX);
    const directAlloc = result.find((a) => a.groupId === null);

    expect(groupAlloc?.amount).toBe(money(1500));
    expect(directAlloc?.amount).toBe(money(500));

    // All allocations are anna → me
    expect(result.every((a) => a.fromUserId === anna && a.toUserId === me)).toBe(true);
  });

  it('partial payment: greedy allocation to largest debt first', () => {
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(1500) }, // largest debt
      { groupId: null, amount: money(500) },
    ];

    const result = allocateSettlement(money(1000), anna, me, debts);

    // €10 goes entirely to group X (largest)
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      groupId: groupX,
      fromUserId: anna,
      toUserId: me,
      amount: money(1000),
    });
  });

  it('partial payment: spills to second context when first is exhausted', () => {
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(1500) },
      { groupId: null, amount: money(500) },
    ];

    const result = allocateSettlement(money(1800), anna, me, debts);

    expect(result).toHaveLength(2);

    const groupAlloc = result.find((a) => a.groupId === groupX);
    const directAlloc = result.find((a) => a.groupId === null);

    expect(groupAlloc?.amount).toBe(money(1500)); // fully allocated
    expect(directAlloc?.amount).toBe(money(300)); // remainder
  });

  it('overpayment: excess goes to direct context', () => {
    const debts: ContextDebt[] = [{ groupId: groupX, amount: money(1500) }];

    const result = allocateSettlement(money(2000), anna, me, debts);

    expect(result).toHaveLength(2);

    const groupAlloc = result.find((a) => a.groupId === groupX);
    const directAlloc = result.find((a) => a.groupId === null);

    expect(groupAlloc?.amount).toBe(money(1500));
    expect(directAlloc?.amount).toBe(money(500)); // overpayment
  });

  it('full settlement with cross-direction debts zeros all contexts', () => {
    // anna owes me €15 in group X, I owe anna €3 in group Y → net = €12
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(1500) }, // anna owes me
      { groupId: groupY, amount: money(-300) }, // I owe anna (negative)
    ];

    const result = allocateSettlement(money(1200), anna, me, debts);

    expect(result).toHaveLength(2);

    // Group X: anna → me €15 (same direction)
    const groupXAlloc = result.find((a) => a.groupId === groupX);
    expect(groupXAlloc).toEqual({
      groupId: groupX,
      fromUserId: anna,
      toUserId: me,
      amount: money(1500),
    });

    // Group Y: me → anna €3 (reversed direction!)
    const groupYAlloc = result.find((a) => a.groupId === groupY);
    expect(groupYAlloc).toEqual({
      groupId: groupY,
      fromUserId: me, // reversed
      toUserId: anna, // reversed
      amount: money(300),
    });
  });

  it('net cash flow invariant: same-direction allocations sum to payment', () => {
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(1500) },
      { groupId: null, amount: money(500) },
    ];

    const result = allocateSettlement(money(2000), anna, me, debts);
    const total = result.reduce((sum, a) => sum + a.amount, 0);

    expect(total).toBe(2000);
  });

  it('net cash flow invariant: cross-direction full settlement', () => {
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(1500) },
      { groupId: groupY, amount: money(-300) },
    ];

    const result = allocateSettlement(money(1200), anna, me, debts);

    // Net = same-dir sum - cross-dir sum = 1500 - 300 = 1200
    const sameDir = result.filter((a) => a.fromUserId === anna);
    const crossDir = result.filter((a) => a.fromUserId === me);

    const sameDirTotal = sameDir.reduce((s, a) => s + a.amount, 0);
    const crossDirTotal = crossDir.reduce((s, a) => s + a.amount, 0);

    expect(sameDirTotal - crossDirTotal).toBe(1200);
  });

  it('no debts: entire payment goes to direct context', () => {
    const result = allocateSettlement(money(1000), anna, me, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      groupId: null,
      fromUserId: anna,
      toUserId: me,
      amount: money(1000),
    });
  });

  it('only cross-direction debts: treated as greedy (no full settlement)', () => {
    // I owe anna €5 in group Y, but anna is paying me?
    // This is a weird case — payment goes to direct context
    const debts: ContextDebt[] = [{ groupId: groupY, amount: money(-500) }];

    const result = allocateSettlement(money(1000), anna, me, debts);

    // No same-direction debts, so remainder goes to direct
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      groupId: null,
      fromUserId: anna,
      toUserId: me,
      amount: money(1000),
    });
  });

  it('throws on zero or negative payment', () => {
    expect(() => allocateSettlement(ZERO, anna, me, [])).toThrow();
    expect(() => allocateSettlement(money(-100), anna, me, [])).toThrow();
  });

  it('multiple groups: allocates largest first', () => {
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(500) },
      { groupId: groupY, amount: money(1500) },
      { groupId: null, amount: money(200) },
    ];

    const result = allocateSettlement(money(2200), anna, me, debts);

    expect(result).toHaveLength(3);

    const xAlloc = result.find((a) => a.groupId === groupX);
    const yAlloc = result.find((a) => a.groupId === groupY);
    const dAlloc = result.find((a) => a.groupId === null);

    expect(xAlloc?.amount).toBe(money(500));
    expect(yAlloc?.amount).toBe(money(1500));
    expect(dAlloc?.amount).toBe(money(200));
  });

  it('adds remainder to existing direct allocation when payment exceeds same-direction debts', () => {
    // anna owes me €5 in group X and €3 direct
    // anna pays me €10 total (overpayment of €2)
    // Greedy: €5 to group X, €3 to direct (fully allocated)
    // Remainder: €2, and direct alloc already exists → uses lines 142-146
    const debts: ContextDebt[] = [
      { groupId: groupX, amount: money(500) },
      { groupId: null, amount: money(300) }, // existing direct debt
    ];

    const result = allocateSettlement(money(1000), anna, me, debts);

    // Should have 2 allocations (group X + direct)
    expect(result).toHaveLength(2);

    const xAlloc = result.find((a) => a.groupId === groupX);
    const dAlloc = result.find((a) => a.groupId === null);

    expect(xAlloc?.amount).toBe(money(500)); // fully allocated
    // direct was 300, remainder is 200 (1000 - 500 - 300), added to existing
    expect(dAlloc?.amount).toBe(money(500)); // 300 + 200
  });

  it('creates new direct allocation when none exists and remainder remains', () => {
    // anna owes me €10 in group X only
    // anna pays me €15 (overpayment)
    // €10 goes to group X, €5 remainder creates new direct allocation
    const debts: ContextDebt[] = [{ groupId: groupX, amount: money(1000) }];

    const result = allocateSettlement(money(1500), anna, me, debts);

    expect(result).toHaveLength(2);

    const xAlloc = result.find((a) => a.groupId === groupX);
    const dAlloc = result.find((a) => a.groupId === null);

    expect(xAlloc?.amount).toBe(money(1000));
    expect(dAlloc).toBeDefined();
    expect(dAlloc?.amount).toBe(money(500));
  });
});
