/**
 * pages/FriendsPage.tsx
 *
 * Route: /friends
 *
 * Friends overview — lists all accepted friends with per-friend balance,
 * ordered by most recent shared friend expense. Tapping a friend navigates to
 * the friend detail page.
 *
 * Balance computation (per friend):
 *   1. For each shared group: calculateGroupBalances → simplifyDebts →
 *      extractSimplifiedDebt to get the simplified bilateral debt in that group.
 *   2. For direct (non-group) expenses: computeBilateralBalance on friend-only
 *      expenses and friend-only settlements.
 *   This matches the group view's simplified perspective instead of using the
 *   raw bilateral calculation that ignores third-party payers.
 */

import EmptyState from '@components/shared/EmptyState';
import { FriendCard } from '@components/shared/FriendCard';
import { PageHeader } from '@components/shared/PageHeader';
import {
  calculateGroupBalances,
  computeBilateralBalance,
  extractSimplifiedDebt,
  simplifyDebts,
} from '@domain/balance';
import { add } from '@domain/money';
import { isSameUser } from '@domain/types';
import type { UserId } from '@domain/types';
import { ZERO } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import {
  expensesQueryOptions,
  friendExpensesQueryOptions,
} from '@features/expenses/expenseQueries';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useGroups } from '@features/groups/hooks/useGroups';
import {
  friendSettlementsQueryOptions,
  settlementsQueryOptions,
} from '@features/settlements/settlementQueries';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { UserPlus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

function FriendSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-10 w-10 animate-pulse rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-16 animate-pulse rounded bg-muted shrink-0" />
    </div>
  );
}

export default function FriendsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: friendExpenses = [], isLoading: friendExpensesLoading } = useQuery(
    friendExpensesQueryOptions(),
  );
  const { data: allFriendSettlements = [], isLoading: friendSettlementsLoading } = useQuery(
    friendSettlementsQueryOptions(),
  );
  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;

  const groupExpensesResults = useQueries({
    queries: groups.map((g) => expensesQueryOptions(g.id)),
  });
  const groupSettlementsResults = useQueries({
    queries: groups.map((g) => settlementsQueryOptions(g.id)),
  });

  const isLoading =
    friendsLoading ||
    friendExpensesLoading ||
    friendSettlementsLoading ||
    groupsLoading ||
    groupExpensesResults.some((r) => r.isLoading) ||
    groupSettlementsResults.some((r) => r.isLoading);

  const friendsWithData = useMemo(() => {
    if (!currentUserId) return [];

    return friends
      .map((friend) => {
        let balance = ZERO;

        // Group contributions: use simplified group debts
        for (let i = 0; i < groups.length; i++) {
          // biome-ignore lint/style/noNonNullAssertion: loop bound guarantees i is in range
          const group = groups[i]!;
          const isMember = group.members.some((m) => isSameUser(m.userId, friend.userId));
          if (!isMember) continue;

          const groupExpenses = groupExpensesResults[i]?.data ?? [];
          const groupSettlements = groupSettlementsResults[i]?.data ?? [];
          const balanceMap = calculateGroupBalances(groupExpenses, groupSettlements, group.members);
          const instructions = simplifyDebts(balanceMap);
          balance = add(balance, extractSimplifiedDebt(instructions, currentUserId, friend.userId));
        }

        // Direct contributions: bilateral on friend-only data
        const directExpenses = friendExpenses.filter(
          (e) =>
            isSameUser(e.paidBy, friend.userId) ||
            e.splits.some((s) => isSameUser(s.userId, friend.userId)),
        );
        const directSettlements = allFriendSettlements.filter(
          (s) => isSameUser(s.fromUserId, friend.userId) || isSameUser(s.toUserId, friend.userId),
        );
        balance = add(
          balance,
          computeBilateralBalance(directExpenses, directSettlements, currentUserId, friend.userId),
        );

        // Use last direct expense date for sorting (group expenses not relevant here)
        const lastExpenseDate = directExpenses[0]?.createdAt;
        return { friend, balance, lastExpenseDate };
      })
      .sort((a, b) => {
        if (!a.lastExpenseDate && !b.lastExpenseDate) return 0;
        if (!a.lastExpenseDate) return 1;
        if (!b.lastExpenseDate) return -1;
        return b.lastExpenseDate.getTime() - a.lastExpenseDate.getTime();
      });
  }, [
    friends,
    groups,
    groupExpensesResults,
    groupSettlementsResults,
    friendExpenses,
    allFriendSettlements,
    currentUserId,
  ]);

  const handleAddFriend = () => navigate({ to: '/friends/add' });

  return (
    <div className="min-h-full pb-24">
      <PageHeader
        title={t('friends.title')}
        variant="large"
        onAction={handleAddFriend}
        actionIcon={<UserPlus className="w-5 h-5" />}
        actionLabel={t('friends.add_friend')}
      />

      <div className="px-5">
        {isLoading && (
          <div className="space-y-3">
            <FriendSkeleton />
            <FriendSkeleton />
            <FriendSkeleton />
          </div>
        )}

        {!isLoading && friends.length === 0 && (
          <EmptyState
            title={t('friends.empty_title')}
            description={t('friends.empty_description')}
            action={
              <button
                type="button"
                onClick={handleAddFriend}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {t('friends.add_friend')}
              </button>
            }
          />
        )}

        {!isLoading && friendsWithData.length > 0 && (
          <div className="space-y-3">
            {friendsWithData.map(({ friend, balance }) => (
              <FriendCard
                key={friend.userId}
                name={friend.displayName}
                balance={balance ?? ZERO}
                onClick={() =>
                  navigate({
                    to: '/friends/$friendId',
                    params: { friendId: friend.userId as string },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
