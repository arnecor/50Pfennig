/**
 * pages/FriendDetailPage.tsx
 *
 * Route: /friends/:friendId
 *
 * Shows all expenses shared between the current user and a specific friend,
 * ordered newest first. Includes the group name for group expenses and "Direkt"
 * for direct (non-group) friend expenses.
 *
 * Actions:
 *   - Send reminder  (placeholder — shows native alert)
 *   - Remove friend  (calls friendRepository.remove, navigates back on success)
 */

import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { calculateParticipantBalances } from '@domain/balance';
import { isPositive, negate } from '@domain/money';
import { ZERO, type GroupId, type Money, type UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { sharedExpensesQueryOptions } from '@features/expenses/expenseQueries';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useRemoveFriend } from '@features/friends/hooks/useRemoveFriend';
import { useGroups } from '@features/groups/hooks/useGroups';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Bell, Receipt, UserMinus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

function ExpenseSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export default function FriendDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { friendId } = useParams({ strict: false }) as { friendId: string };

  const currentUserId = useAuthStore(s => s.session?.user.id) as UserId | undefined;

  const { data: friends = [] } = useFriends();
  const friend = friends.find(f => (f.userId as string) === friendId);

  const { data: groups = [] } = useGroups();
  const { data: sharedExpenses = [], isLoading } = useQuery(
    sharedExpensesQueryOptions(friendId as UserId),
  );

  const removeFriend = useRemoveFriend();

  const groupNameMap = useMemo(
    () => new Map<GroupId, string>(groups.map(g => [g.id, g.name])),
    [groups],
  );

  const netBalance = useMemo(() => {
    if (!currentUserId) return ZERO;
    return calculateParticipantBalances(sharedExpenses).get(currentUserId) ?? ZERO;
  }, [sharedExpenses, currentUserId]);

  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const handleBack = () => navigate({ to: '/friends' });

  const handleSendReminder = () => {
    window.alert(t('friends.send_reminder_coming_soon'));
  };

  const handleRemoveFriend = () => {
    if (!friend) return;
    if (!window.confirm(t('friends.remove_friend_confirm'))) return;
    removeFriend.mutate(friend.friendshipId, {
      onSuccess: () => navigate({ to: '/friends' }),
      onError: () => window.alert(t('common.error_generic')),
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {friend?.displayName ?? '…'}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSendReminder}
          className="shrink-0 gap-1.5"
        >
          <Bell className="h-4 w-4" />
          {t('friends.send_reminder')}
        </Button>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="space-y-3">
            <ExpenseSkeleton />
            <ExpenseSkeleton />
            <ExpenseSkeleton />
          </div>
        )}

        {!isLoading && sharedExpenses.length === 0 && (
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title={t('friends.no_shared_expenses')}
            description={t('friends.no_shared_expenses_description')}
          />
        )}

        {!isLoading && sharedExpenses.length > 0 && (
          <>
            {/* Balance summary — shows who owes whom */}
            <div className="mb-4 rounded-lg bg-muted/50 px-4 py-3 text-center">
              {netBalance === ZERO ? (
                <p className="text-sm font-semibold">{t('friends.balanced')}</p>
              ) : (
                <>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {isPositive(netBalance)
                      ? t('friends.friend_owes_you', { name: friend?.displayName ?? '…' })
                      : t('friends.you_owe_friend', { name: friend?.displayName ?? '…' })}
                  </p>
                  <MoneyDisplay
                    amount={isPositive(netBalance) ? netBalance : negate(netBalance)}
                    colored={false}
                    className="text-lg font-bold tabular-nums"
                  />
                </>
              )}
            </div>

            {/* Expense list */}
            <div className="space-y-3">
              {sharedExpenses.map(expense => {
                const paidByCurrentUser =
                  (expense.paidBy as string) === (currentUserId as string);
                const paidByName = paidByCurrentUser
                  ? t('common.you')
                  : (friend?.displayName ?? '…');
                const myShare = currentUserId
                  ? expense.splits.find(s => s.userId === currentUserId)?.amount ?? ZERO
                  : ZERO;
                const participantCount = expense.splits.length;
                const signedShare = paidByCurrentUser
                  ? ((expense.totalAmount - myShare) as Money)
                  : negate(myShare);
                return (
                  <Card key={expense.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{expense.description}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {paidByName}
                            {' · '}
                            {expense.groupId
                              ? (groupNameMap.get(expense.groupId) ?? t('groups.title'))
                              : t('friends.direct_expense')}
                            {participantCount > 2 && (
                              <> · {t('friends.participant_count', { count: participantCount })}</>
                            )}
                            {' · '}
                            {expense.createdAt.toLocaleDateString(dateLocale, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <MoneyDisplay
                            amount={signedShare}
                            showSign
                            colored
                            className="text-sm font-semibold tabular-nums"
                          />
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t('friends.total')}{' '}
                            <MoneyDisplay
                              amount={expense.totalAmount}
                              className="inline text-xs tabular-nums"
                            />
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Remove friend — sticky footer, always visible above bottom nav */}
      {!isLoading && (
        <div className="shrink-0 border-t px-4 py-3">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleRemoveFriend}
            disabled={removeFriend.isPending || !friend}
          >
            <UserMinus className="mr-2 h-4 w-4" />
            {t('friends.remove_friend')}
          </Button>
        </div>
      )}
    </div>
  );
}
