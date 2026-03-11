/**
 * pages/FriendDetailPage.tsx
 *
 * Route: /friends/:friendId
 *
 * Shows a unified activity list (expenses + settlements) between the current
 * user and a specific friend, ordered newest first.
 *
 * Settlement rows are visually distinct from expense rows.
 * Settlements are grouped by batchId so one batch = one row (full amount shown).
 *
 * Actions:
 *   - Begleichen        → opens RecordFriendSettlementSheet (when netBalance ≠ 0)
 *   - Delete settlement → calls useDeleteSettlement (full batch)
 *   - Send reminder     → placeholder
 *   - Remove friend     → calls friendRepository.remove, navigates back on success
 */

import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { computeBilateralBalance } from '@domain/balance';
import { add, isPositive, negate } from '@domain/money';
import { ZERO, type GroupId, type Money, type Settlement, type UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { sharedExpensesQueryOptions } from '@features/expenses/expenseQueries';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useRemoveFriend } from '@features/friends/hooks/useRemoveFriend';
import { useGroups } from '@features/groups/hooks/useGroups';
import RecordFriendSettlementSheet from '@features/settlements/components/RecordFriendSettlementSheet';
import { useDeleteSettlement } from '@features/settlements/hooks/useDeleteSettlement';
import { sharedSettlementsQueryOptions } from '@features/settlements/settlementQueries';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowLeftRight, Bell, Receipt, Trash2, UserMinus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Expense } from '@domain/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettlementBatch = {
  records: Settlement[];
  total: Money;
  note?: string;
  date: Date;
};

type FeedItem =
  | { kind: 'expense'; data: Expense }
  | { kind: 'settlement'; batch: SettlementBatch };

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function ItemSkeleton() {
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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
  const { data: sharedSettlements = [] } = useQuery(
    sharedSettlementsQueryOptions(friendId as UserId),
  );

  const removeFriend = useRemoveFriend();
  const deleteSettlement = useDeleteSettlement();

  const [showSettleSheet, setShowSettleSheet] = useState(false);

  const groupNameMap = useMemo(
    () => new Map<GroupId, string>(groups.map(g => [g.id, g.name])),
    [groups],
  );

  const netBalance = useMemo(() => {
    if (!currentUserId || !friend) return ZERO;
    return computeBilateralBalance(sharedExpenses, sharedSettlements, currentUserId, friend.userId);
  }, [sharedExpenses, sharedSettlements, currentUserId, friend]);

  // Build unified activity feed (expenses + settlement batches), newest first.
  // Only include expenses where current user or friend paid (bilateral effect).
  const feedItems = useMemo((): FeedItem[] => {
    const bilateralExpenses = friend
      ? sharedExpenses.filter(
          e =>
            (e.paidBy as string) === (currentUserId as string) ||
            (e.paidBy as string) === (friend.userId as string),
        )
      : sharedExpenses;
    const items: FeedItem[] = bilateralExpenses.map(e => ({ kind: 'expense' as const, data: e }));

    // Group settlements by batchId; null batchId = standalone single record
    const batchMap = new Map<string, Settlement[]>();
    for (const s of sharedSettlements) {
      const key = s.batchId ?? String(s.id);
      const existing = batchMap.get(key) ?? [];
      existing.push(s);
      batchMap.set(key, existing);
    }

    for (const records of batchMap.values()) {
      const total = records.reduce((sum, r) => add(sum, r.amount), ZERO) as Money;
      const note  = records.find(r => r.note)?.note;
      const date  = records.reduce(
        (latest, r) => (r.createdAt > latest ? r.createdAt : latest),
        (records[0] ?? { createdAt: new Date(0) }).createdAt,
      );
      items.push({ kind: 'settlement', batch: { records, total, ...(note !== undefined && { note }), date } });
    }

    items.sort((a, b) => {
      const da = a.kind === 'expense' ? a.data.createdAt : a.batch.date;
      const db = b.kind === 'expense' ? b.data.createdAt : b.batch.date;
      return db.getTime() - da.getTime();
    });

    return items;
  }, [sharedExpenses, sharedSettlements, friend, currentUserId]);

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

  const handleDeleteSettlement = (batch: SettlementBatch) => {
    if (!window.confirm(t('settlements.delete_confirm'))) return;
    deleteSettlement.mutate(batch.records);
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
            <ItemSkeleton />
            <ItemSkeleton />
            <ItemSkeleton />
          </div>
        )}

        {!isLoading && sharedExpenses.length === 0 && sharedSettlements.length === 0 && (
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title={t('friends.no_shared_expenses')}
            description={t('friends.no_shared_expenses_description')}
          />
        )}

        {!isLoading && feedItems.length > 0 && (
          <>
            {/* Balance summary */}
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
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setShowSettleSheet(true)}
                      disabled={!friend || !currentUserId}
                    >
                      {t('settlements.settle_up')}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Unified activity list */}
            <div className="space-y-3">
              {feedItems.map((item, idx) => {
                if (item.kind === 'expense') {
                  const expense = item.data;
                  const paidByCurrentUser =
                    (expense.paidBy as string) === (currentUserId as string);
                  const paidByName = paidByCurrentUser
                    ? t('common.you')
                    : (friend?.displayName ?? '…');
                  const participantCount = expense.splits.length;
                  // Bilateral share: only the effect between current user and friend
                  const signedShare = paidByCurrentUser
                    ? (expense.splits.find(s => (s.userId as string) === (friend?.userId as string))?.amount ?? ZERO)
                    : negate(
                        currentUserId
                          ? expense.splits.find(s => s.userId === currentUserId)?.amount ?? ZERO
                          : ZERO,
                      );

                  return (
                    <Card key={`expense-${String(expense.id)}`}>
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
                }

                // Settlement row
                const { batch } = item;
                const paidByFriend =
                  (batch.records[0]?.fromUserId as string) === (friend?.userId as string);
                const label = paidByFriend
                  ? t('settlements.friend_paid_you', { name: friend?.displayName ?? '…' })
                  : t('settlements.you_paid_friend', { name: friend?.displayName ?? '…' });

                return (
                  <div
                    key={`settlement-${String(batch.records[0]?.id ?? idx)}`}
                    className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3"
                  >
                    <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {batch.note && <>{batch.note} · </>}
                        {batch.date.toLocaleDateString(dateLocale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <MoneyDisplay
                      amount={batch.total}
                      className="shrink-0 text-sm font-semibold tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteSettlement(batch)}
                      disabled={deleteSettlement.isPending}
                      aria-label={t('settlements.delete_aria')}
                      className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Remove friend — sticky footer */}
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

      {/* Settle up sheet */}
      {showSettleSheet && friend && currentUserId && (
        <RecordFriendSettlementSheet
          friend={friend}
          currentUserId={currentUserId}
          sharedExpenses={sharedExpenses}
          sharedSettlements={sharedSettlements}
          onClose={() => setShowSettleSheet(false)}
        />
      )}
    </div>
  );
}
