/**
 * features/balances/hooks/useTotalBalance.ts
 *
 * Derives cross-group balance totals for the current user.
 *
 * Returns:
 *   youAreOwed — sum of per-group balances where the user is in credit (> 0)
 *   youOwe     — sum of per-group balances where the user is in debt (< 0), stored as negative
 *   netTotal   — youAreOwed + youOwe
 *   isLoading  — true while any group/expense/settlement data is still loading
 *
 * Uses useQueries to fetch expenses and settlements for all groups in parallel.
 * Balance calculation is pure (calculateGroupBalances from domain/balance).
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useGroups } from '@features/groups/hooks/useGroups';
import { expensesQueryOptions } from '@features/expenses/expenseQueries';
import { settlementsQueryOptions } from '@features/settlements/settlementQueries';
import { calculateGroupBalances } from '@domain/balance';
import { ZERO, add, isPositive, isNegative } from '@domain/money';
import type { Money, UserId } from '@domain/types';

type TotalBalance = {
  youAreOwed: Money;
  youOwe:     Money;
  netTotal:   Money;
  isLoading:  boolean;
};

export function useTotalBalance(currentUserId: UserId | undefined): TotalBalance {
  const { data: groups = [], isLoading: groupsLoading } = useGroups();

  // Fetch expenses and settlements for every group in parallel.
  const expensesResults = useQueries({
    queries: groups.map(g => expensesQueryOptions(g.id)),
  });
  const settlementsResults = useQueries({
    queries: groups.map(g => settlementsQueryOptions(g.id)),
  });

  const isLoading =
    groupsLoading ||
    expensesResults.some(r => r.isLoading) ||
    settlementsResults.some(r => r.isLoading);

  return useMemo((): TotalBalance => {
    if (!currentUserId || groups.length === 0) {
      return { youAreOwed: ZERO, youOwe: ZERO, netTotal: ZERO, isLoading };
    }

    let youAreOwed: Money = ZERO;
    let youOwe:     Money = ZERO;

    for (let i = 0; i < groups.length; i++) {
      const group      = groups[i]!;
      const expenses   = expensesResults[i]?.data   ?? [];
      const settlements = settlementsResults[i]?.data ?? [];

      const balanceMap = calculateGroupBalances(expenses, settlements, group.members);
      const userBalance = balanceMap.get(currentUserId) ?? ZERO;

      if (isPositive(userBalance)) {
        youAreOwed = add(youAreOwed, userBalance);
      } else if (isNegative(userBalance)) {
        youOwe = add(youOwe, userBalance); // stays negative
      }
    }

    return {
      youAreOwed,
      youOwe,
      netTotal: add(youAreOwed, youOwe),
      isLoading,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, groups, expensesResults, settlementsResults, isLoading]);
}
