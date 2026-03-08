/**
 * domain/settlement/index.ts
 *
 * Settlement allocation across accounting contexts (ADR-0012).
 *
 * When a person pays back money, the payment may need to be distributed
 * across multiple contexts (groups + direct) to keep all balances correct.
 *
 * This module contains the pure allocation algorithm.
 *
 * Tested in: settlement.test.ts
 */

import { abs, isNegative, isPositive, subtract } from '../money';
import type { GroupId, Money, UserId } from '../types';
import { ZERO, money } from '../types';

/**
 * A debt in a specific context (group or direct).
 * Positive amount = they owe the current user.
 * Negative amount = the current user owes them.
 */
export type ContextDebt = {
  readonly groupId: GroupId | null; // null = direct/friend context
  readonly amount: Money;           // signed: positive = they owe me
};

/**
 * One allocation record: how much of the payment goes to a specific context.
 * The from/to may differ from the main payment direction for cross-direction
 * full settlements (see ADR-0012, full-settlement shortcut).
 */
export type SettlementAllocation = {
  readonly groupId: GroupId | null;
  readonly fromUserId: UserId;
  readonly toUserId: UserId;
  readonly amount: Money; // always positive
};

/**
 * Allocates a payment amount across multiple accounting contexts.
 *
 * @param paymentAmount - The total amount being paid (positive integer cents)
 * @param fromUserId    - Who is sending the money
 * @param toUserId      - Who is receiving the money
 * @param debts         - Per-context debts between these two users.
 *                        Positive = toUserId owes fromUserId (same direction as payment).
 *                        Negative = fromUserId owes toUserId (opposite direction).
 *
 * Algorithm:
 *   1. Check if this is a full settlement (payment === net debt). If so,
 *      zero out ALL contexts, including cross-direction ones.
 *   2. Otherwise, allocate greedily to same-direction debts (largest first).
 *   3. Any remainder goes to the direct context (group_id = null).
 *
 * Returns: One allocation per context that receives part of the payment.
 *
 * Invariant: The net cash flow of all allocations always equals paymentAmount.
 *   For same-direction allocations: sum(amounts) === paymentAmount.
 *   For full settlement with cross-direction: sum(same-dir) - sum(cross-dir) === paymentAmount.
 */
export const allocateSettlement = (
  paymentAmount: Money,
  fromUserId: UserId,
  toUserId: UserId,
  debts: readonly ContextDebt[],
): SettlementAllocation[] => {
  if (paymentAmount <= ZERO) {
    throw new Error(`Payment amount must be positive, got ${paymentAmount}`);
  }

  // Separate same-direction debts (they owe me) from cross-direction (I owe them)
  const sameDirection: Array<{ groupId: GroupId | null; amount: Money }> = [];
  const crossDirection: Array<{ groupId: GroupId | null; amount: Money }> = [];

  for (const debt of debts) {
    if (isPositive(debt.amount)) {
      sameDirection.push({ groupId: debt.groupId, amount: debt.amount });
    } else if (isNegative(debt.amount)) {
      crossDirection.push({ groupId: debt.groupId, amount: abs(debt.amount) });
    }
  }

  // Sort both by amount descending (largest debt first)
  sameDirection.sort((a, b) => b.amount - a.amount);
  crossDirection.sort((a, b) => b.amount - a.amount);

  // Check for full settlement: payment === net debt
  const totalSameDir = sameDirection.reduce((sum, d) => sum + d.amount, 0);
  const totalCrossDir = crossDirection.reduce((sum, d) => sum + d.amount, 0);
  const netDebt = totalSameDir - totalCrossDir;

  if (netDebt > 0 && paymentAmount === money(netDebt)) {
    // Full settlement — zero out all contexts
    const allocations: SettlementAllocation[] = [];

    // Same direction: fromUserId → toUserId (normal)
    for (const debt of sameDirection) {
      allocations.push({
        groupId: debt.groupId,
        fromUserId,
        toUserId,
        amount: debt.amount,
      });
    }

    // Cross direction: toUserId → fromUserId (reversed)
    for (const debt of crossDirection) {
      allocations.push({
        groupId: debt.groupId,
        fromUserId: toUserId,
        toUserId: fromUserId,
        amount: debt.amount,
      });
    }

    return allocations;
  }

  // Greedy allocation to same-direction debts
  const allocations: SettlementAllocation[] = [];
  let remaining = paymentAmount;

  for (const debt of sameDirection) {
    if (remaining <= ZERO) break;

    const allocated = money(Math.min(remaining, debt.amount));
    allocations.push({
      groupId: debt.groupId,
      fromUserId,
      toUserId,
      amount: allocated,
    });
    remaining = subtract(remaining, allocated);
  }

  // If there's a remainder (overpayment or no matching debts), put it in direct context
  if (remaining > ZERO) {
    const directAlloc = allocations.find(a => a.groupId === null);
    if (directAlloc) {
      // Add to existing direct allocation
      const idx = allocations.indexOf(directAlloc);
      allocations[idx] = {
        ...directAlloc,
        amount: money(directAlloc.amount + remaining),
      };
    } else {
      allocations.push({
        groupId: null,
        fromUserId,
        toUserId,
        amount: remaining,
      });
    }
  }

  return allocations;
};
