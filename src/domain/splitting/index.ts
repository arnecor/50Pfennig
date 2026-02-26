/**
 * domain/splitting/index.ts
 *
 * The core expense-splitting algorithm.
 *
 * Pure function — no side effects, no I/O, no framework dependencies.
 * The returned amounts always sum exactly to totalAmount (guaranteed by allocate()).
 *
 * See ADR-0002 (domain separation), ADR-0003 (integer cents / basis points).
 */

import { allocate } from '../money';
import { type Money, type UserId, type ExpenseSplit } from '../types';

/**
 * Computes how much each participant owes for an expense.
 *
 * @param totalAmount  - The full expense amount in cents
 * @param participants - Ordered list of user IDs who share the expense
 * @param split        - The split configuration (equal / exact / percentage)
 * @returns            Map of userId → amount owed in cents
 *
 * Invariant: sum(values) === totalAmount  (enforced by allocate())
 *
 * Note: the payer is NOT excluded here. The caller is responsible for
 * net balance logic (credit payer, debit all participants including payer).
 */
export const splitExpense = (
  totalAmount: Money,
  participants: readonly UserId[],
  split: ExpenseSplit,
): Record<UserId, Money> => {
  if (participants.length === 0) {
    throw new Error('Cannot split an expense among zero participants');
  }

  switch (split.type) {
    case 'equal': {
      const shares = allocate(totalAmount, participants.map(() => 1));
      return Object.fromEntries(
        participants.map((userId, i) => [userId, shares[i]]),
      ) as Record<UserId, Money>;
    }

    case 'exact': {
      // Every participant must have an explicit amount
      for (const userId of participants) {
        if (!(userId in split.amounts)) {
          throw new Error(
            `Exact split is missing an amount for participant "${userId}"`,
          );
        }
      }

      // The amounts must sum exactly to the total
      const sum = participants.reduce(
        (acc, userId) => acc + (split.amounts[userId] ?? 0),
        0,
      );
      if (sum !== totalAmount) {
        throw new Error(
          `Exact split amounts sum to ${sum} cents but total is ${totalAmount} cents`,
        );
      }

      return Object.fromEntries(
        participants.map((userId) => [userId, split.amounts[userId]]),
      ) as Record<UserId, Money>;
    }

    case 'percentage': {
      // Basis points for all participants must sum to exactly 10000 (= 100.00%)
      const bpSum = participants.reduce(
        (acc, userId) => acc + (split.basisPoints[userId] ?? 0),
        0,
      );
      if (bpSum !== 10000) {
        throw new Error(
          `Percentage split basis points sum to ${bpSum} but must equal 10000`,
        );
      }

      const ratios = participants.map((userId) => split.basisPoints[userId] ?? 0);
      const shares = allocate(totalAmount, ratios);
      return Object.fromEntries(
        participants.map((userId, i) => [userId, shares[i]]),
      ) as Record<UserId, Money>;
    }
  }
};
