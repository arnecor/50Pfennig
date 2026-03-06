/**
 * features/balances/hooks/useTotalBalance.ts
 *
 * Derives cross-group + cross-friend balance totals for the current user.
 *
 * Returns:
 *   youAreOwed — sum of balances where the user is in credit (> 0)
 *   youOwe     — sum of balances where the user is in debt (< 0), stored as negative
 *   netTotal   — youAreOwed + youOwe
 *   isLoading  — true while any data is still loading
 *
 * Sources:
 *   - Group expenses + settlements: fetched per group via useQueries
 *   - Friend expenses (group_id IS NULL): fetched via friendExpensesQueryOptions
 *
 * Balance calculation is pure (calculateGroupBalances / calculateParticipantBalances).
 */

import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useGroups } from '@features/groups/hooks/useGroups';
import { useFriends } from '@features/friends/hooks/useFriends';
import { expensesQueryOptions, friendExpensesQueryOptions } from '@features/expenses/expenseQueries';
import { settlementsQueryOptions } from '@features/settlements/settlementQueries';
import { calculateGroupBalances, calculateParticipantBalances } from '@domain/balance';
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
  const { data: friends = [], isLoading: friendsLoading } = useFriends();

  // Fetch group expenses and settlements in parallel.
  const expensesResults    = useQueries({ queries: groups.map((g) => expensesQueryOptions(g.id)) });
  const settlementsResults = useQueries({ queries: groups.map((g) => settlementsQueryOptions(g.id)) });

  // Fetch friend expenses (group_id IS NULL).
  const { data: friendExpenses = [], isLoading: friendExpensesLoading } =
    useQuery(friendExpensesQueryOptions());

  const isLoading =
    groupsLoading ||
    friendsLoading ||
    friendExpensesLoading ||
    expensesResults.some(r => r.isLoading) ||
    settlementsResults.some(r => r.isLoading);

  return useMemo((): TotalBalance => {
    if (!currentUserId) {
      return { youAreOwed: ZERO, youOwe: ZERO, netTotal: ZERO, isLoading };
    }

    let youAreOwed: Money = ZERO;
    let youOwe:     Money = ZERO;

    const accumulate = (balance: Money) => {
      if (isPositive(balance)) youAreOwed = add(youAreOwed, balance);
      else if (isNegative(balance)) youOwe = add(youOwe, balance);
    };

    // Group balances — one balance per group, accumulated independently.
    for (let i = 0; i < groups.length; i++) {
      const group       = groups[i]!;
      const expenses    = expensesResults[i]?.data   ?? [];
      const settlements = settlementsResults[i]?.data ?? [];
      const balanceMap  = calculateGroupBalances(expenses, settlements, group.members);
      accumulate(balanceMap.get(currentUserId) ?? ZERO);
    }

    // Friend expense balances — accumulated per-friend so that positive and
    // negative balances with different friends don't cancel each other out.
    if (friendExpenses.length > 0) {
      for (const friend of friends) {
        const friendIdStr = friend.userId as string;
        const shared = friendExpenses.filter(
          e =>
            (e.paidBy as string) === friendIdStr ||
            e.splits.some(s => (s.userId as string) === friendIdStr),
        );
        if (shared.length === 0) continue;
        const balanceMap = calculateParticipantBalances(shared);
        accumulate(balanceMap.get(currentUserId) ?? ZERO);
      }
    }

    return {
      youAreOwed,
      youOwe,
      netTotal: add(youAreOwed, youOwe),
      isLoading,
    };
  }, [currentUserId, groups, friends, expensesResults, settlementsResults, friendExpenses, isLoading]);
}
