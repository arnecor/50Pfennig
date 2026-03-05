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
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { calculateParticipantBalances } from '@domain/balance';
import { ZERO, type UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { friendExpensesQueryOptions } from '@features/expenses/expenseQueries';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { UserPlus, UserRound } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

function FriendSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-16 animate-pulse rounded bg-muted shrink-0" />
      </div>
    </div>
  );
}

export default function FriendsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: friendExpenses = [], isLoading: expensesLoading } = useQuery(
    friendExpensesQueryOptions(),
  );
  const currentUserId = useAuthStore(s => s.session?.user.id) as UserId | undefined;

  const isLoading = friendsLoading || expensesLoading;

  // For each friend: derive direct balance and date of last shared expense.
  const friendsWithData = useMemo(() => {
    if (!currentUserId) return [];

    return friends
      .map(friend => {
        const friendIdStr = friend.userId as string;
        const shared = friendExpenses.filter(
          e =>
            (e.paidBy as string) === friendIdStr ||
            e.splits.some(s => (s.userId as string) === friendIdStr),
        );
        const balances = calculateParticipantBalances(shared);
        const balance = balances.get(currentUserId) ?? ZERO;
        // friendExpenses is already ordered newest-first by the repository
        const lastExpenseDate = shared[0]?.createdAt;
        return { friend, balance, lastExpenseDate };
      })
      .sort((a, b) => {
        if (!a.lastExpenseDate && !b.lastExpenseDate) return 0;
        if (!a.lastExpenseDate) return 1;
        if (!b.lastExpenseDate) return -1;
        return b.lastExpenseDate.getTime() - a.lastExpenseDate.getTime();
      });
  }, [friends, friendExpenses, currentUserId]);

  const handleAddFriend = () => {
    navigate({ to: '/friends/add' });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-4">
        <h1 className="text-xl font-semibold">{t('friends.title')}</h1>
        <Button variant="ghost" size="sm" onClick={handleAddFriend} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          {t('friends.add_friend')}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="space-y-3">
            <FriendSkeleton />
            <FriendSkeleton />
            <FriendSkeleton />
          </div>
        )}

        {!isLoading && friends.length === 0 && (
          <EmptyState
            icon={<UserRound className="h-12 w-12" />}
            title={t('friends.empty_title')}
            description={t('friends.empty_description')}
            action={
              <Button onClick={handleAddFriend} className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t('friends.add_friend')}
              </Button>
            }
          />
        )}

        {!isLoading && friendsWithData.length > 0 && (
          <div className="space-y-3">
            {friendsWithData.map(({ friend, balance }) => (
              <Card
                key={friend.userId}
                className="cursor-pointer active:opacity-80"
                onClick={() =>
                  navigate({
                    to: '/friends/$friendId',
                    params: { friendId: friend.userId as string },
                  })
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {friend.displayName[0]?.toUpperCase() ?? '?'}
                    </div>
                    <p className="min-w-0 flex-1 truncate font-medium">{friend.displayName}</p>
                    <div className="shrink-0 text-right">
                      {balance === ZERO ? (
                        <span className="text-sm text-muted-foreground">
                          {t('friends.balanced')}
                        </span>
                      ) : (
                        <MoneyDisplay
                          amount={balance}
                          colored
                          showSign
                          className="text-sm font-semibold tabular-nums"
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
