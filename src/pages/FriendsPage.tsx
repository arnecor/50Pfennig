/**
 * pages/FriendsPage.tsx
 *
 * Route: /friends
 *
 * Friends overview — lists all accepted friends with per-friend direct balance,
 * ordered by most recent shared friend expense. Tapping a friend navigates to
 * the friend detail page.
 */

import EmptyState from '@components/shared/EmptyState';
import { PageHeader } from '@components/shared/PageHeader';
import { FriendCard } from '@components/shared/FriendCard';
import { computeBilateralBalance } from '@domain/balance';
import type { Expense, UserId } from '@domain/types';
import { ZERO } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { expensesQueryOptions, friendExpensesQueryOptions } from '@features/expenses/expenseQueries';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useGroups } from '@features/groups/hooks/useGroups';
import { sharedSettlementsQueryOptions } from '@features/settlements/settlementQueries';
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
  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const currentUserId = useAuthStore(s => s.session?.user.id) as UserId | undefined;

  const groupExpensesResults = useQueries({ queries: groups.map(g => expensesQueryOptions(g.id)) });
  const sharedSettlementsResults = useQueries({
    queries: friends.map(f => sharedSettlementsQueryOptions(f.userId)),
  });

  const isLoading =
    friendsLoading ||
    friendExpensesLoading ||
    groupsLoading ||
    groupExpensesResults.some(r => r.isLoading) ||
    sharedSettlementsResults.some(r => r.isLoading);

  const allExpenses = useMemo(() => {
    const result: Expense[] = [...friendExpenses];
    for (const r of groupExpensesResults) {
      if (r.data) result.push(...r.data);
    }
    return result;
  }, [friendExpenses, groupExpensesResults]);

  const friendsWithData = useMemo(() => {
    if (!currentUserId) return [];
    return friends
      .map((friend, i) => {
        const friendIdStr = friend.userId as string;
        const shared = allExpenses.filter(
          e =>
            (e.paidBy as string) === friendIdStr ||
            e.splits.some(s => (s.userId as string) === friendIdStr),
        );
        const friendSettlements = sharedSettlementsResults[i]?.data ?? [];
        const balance = computeBilateralBalance(shared, friendSettlements, currentUserId, friend.userId);
        const lastExpenseDate = shared[0]?.createdAt;
        return { friend, balance, lastExpenseDate };
      })
      .sort((a, b) => {
        if (!a.lastExpenseDate && !b.lastExpenseDate) return 0;
        if (!a.lastExpenseDate) return 1;
        if (!b.lastExpenseDate) return -1;
        return b.lastExpenseDate.getTime() - a.lastExpenseDate.getTime();
      });
  }, [friends, allExpenses, sharedSettlementsResults, currentUserId]);

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
