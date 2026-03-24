/**
 * pages/FriendDetailPage.tsx
 *
 * Route: /friends/:friendId
 *
 * Shows a unified activity list (expenses + settlements) between the current
 * user and a specific friend, ordered newest first.
 */

import { cn } from '@/lib/utils';
import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { PageHeader } from '@components/shared/PageHeader';
import { Button } from '@components/ui/button';
import { computeBilateralBalance } from '@domain/balance';
import { abs, add, formatMoney, isNegative, isPositive, negate, subtract } from '@domain/money';
import { type GroupId, type Money, type Settlement, type UserId, ZERO } from '@domain/types';
import type { Expense } from '@domain/types';
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
import { ArrowLeftRight, Bell, Receipt, Trash2, TrendingDown, TrendingUp, UserMinus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type SettlementBatch = {
  records: Settlement[];
  total: Money;
  iMePaying: boolean;
  note?: string;
  date: Date;
};

type FeedItem = { kind: 'expense'; data: Expense } | { kind: 'settlement'; batch: SettlementBatch };

function ItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0 px-1">
      <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-16 animate-pulse rounded bg-muted shrink-0" />
    </div>
  );
}

export default function FriendDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { friendId } = useParams({ strict: false }) as { friendId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;

  const { data: friends = [] } = useFriends();
  const friend = friends.find((f) => (f.userId as string) === friendId);

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
    () => new Map<GroupId, string>(groups.map((g) => [g.id, g.name])),
    [groups],
  );

  const netBalance = useMemo(() => {
    if (!currentUserId || !friend) return ZERO;
    return computeBilateralBalance(sharedExpenses, sharedSettlements, currentUserId, friend.userId);
  }, [sharedExpenses, sharedSettlements, currentUserId, friend]);

  const feedItems = useMemo((): FeedItem[] => {
    const bilateralExpenses = friend
      ? sharedExpenses.filter(
          (e) =>
            (e.paidBy as string) === (currentUserId as string) ||
            (e.paidBy as string) === (friend.userId as string),
        )
      : sharedExpenses;
    const items: FeedItem[] = bilateralExpenses.map((e) => ({ kind: 'expense' as const, data: e }));

    const batchMap = new Map<string, Settlement[]>();
    for (const s of sharedSettlements) {
      const key = s.batchId ?? String(s.id);
      const existing = batchMap.get(key) ?? [];
      existing.push(s);
      batchMap.set(key, existing);
    }

    for (const records of batchMap.values()) {
      let netFromMe: Money = ZERO;
      for (const r of records) {
        if ((r.fromUserId as string) === (currentUserId as string)) {
          netFromMe = add(netFromMe, r.amount);
        } else {
          netFromMe = subtract(netFromMe, r.amount);
        }
      }
      const iMePaying = !isNegative(netFromMe);
      const total = abs(netFromMe) as Money;
      const note = records.find((r) => r.note)?.note;
      const date = records.reduce(
        (latest, r) => (r.createdAt > latest ? r.createdAt : latest),
        (records[0] ?? { createdAt: new Date(0) }).createdAt,
      );
      items.push({
        kind: 'settlement',
        batch: { records, total, iMePaying, ...(note !== undefined && { note }), date },
      });
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
  const handleSendReminder = () => window.alert(t('friends.send_reminder_coming_soon'));
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

  const balanceSettled = netBalance === ZERO;
  const balancePositive = isPositive(netBalance);

  return (
    <div className="min-h-full pb-24">
      <PageHeader
        title={friend?.displayName ?? '…'}
        onBack={handleBack}
        onAction={handleSendReminder}
        actionIcon={<Bell className="w-5 h-5" />}
        actionLabel={t('friends.send_reminder')}
      />

      <div className="px-5">
        {isLoading && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden px-4 mb-5">
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
            {/* Balance summary card */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-5 text-center">
              {balanceSettled ? (
                <p className="text-lg font-bold text-foreground">{t('friends.balanced')}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-1">
                    {balancePositive
                      ? t('friends.friend_owes_you', { name: friend?.displayName ?? '…' })
                      : t('friends.you_owe_friend', { name: friend?.displayName ?? '…' })}
                  </p>
                  <p
                    className={cn(
                      'text-4xl font-bold mb-4',
                      balancePositive ? 'text-owed-to-you' : 'text-you-owe',
                    )}
                  >
                    {balancePositive ? '+' : ''}
                    {formatMoney(netBalance)}
                  </p>
                  <Button
                    onClick={() => setShowSettleSheet(true)}
                    disabled={!friend || !currentUserId}
                    className="w-full h-12 font-semibold bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {t('settlements.settle_up')}
                  </Button>
                </>
              )}
            </div>

            {/* Activity list */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden px-4">
              {feedItems.map((item, idx) => {
                if (item.kind === 'expense') {
                  const expense = item.data;
                  const paidByCurrentUser =
                    (expense.paidBy as string) === (currentUserId as string);
                  const paidByName = paidByCurrentUser
                    ? t('common.you')
                    : (friend?.displayName ?? '…');
                  const signedShare = paidByCurrentUser
                    ? (expense.splits.find(
                        (s) => (s.userId as string) === (friend?.userId as string),
                      )?.amount ?? ZERO)
                    : negate(
                        currentUserId
                          ? (expense.splits.find((s) => s.userId === currentUserId)?.amount ?? ZERO)
                          : ZERO,
                      );

                  const paidByStr = expense.paidBy as string;
                  const otherSplits = expense.splits.filter(
                    (s) => (s.userId as string) !== paidByStr,
                  );
                  let sharedWithLabel: string;
                  if (expense.groupId) {
                    sharedWithLabel = groupNameMap.get(expense.groupId) ?? t('groups.title');
                  } else if (otherSplits.length === 1) {
                    // biome-ignore lint/style/noNonNullAssertion: length === 1 guarantees element exists
                    const otherId = otherSplits[0]!.userId as string;
                    sharedWithLabel =
                      otherId === (currentUserId as string)
                        ? t('common.you_dative')
                        : (friend?.displayName ?? '…');
                  } else {
                    sharedWithLabel = t('expenses.x_people', { count: expense.splits.length });
                  }

                  const formattedDate = expense.createdAt.toLocaleDateString(dateLocale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });

                  return (
                    <button
                      key={`expense-${String(expense.id)}`}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/expenses/$expenseId',
                          params: { expenseId: String(expense.id) },
                        })
                      }
                      className="w-full flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-left px-1"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        {paidByCurrentUser ? (
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {expense.description}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t('expenses.paid_by_label')}: {paidByName} · {t('expenses.with')}:{' '}
                          {sharedWithLabel} · {formattedDate}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <MoneyDisplay
                          amount={expense.totalAmount}
                          className="block text-sm font-semibold tabular-nums"
                        />
                        <span className="text-xs text-muted-foreground">
                          {t('expenses.my_share')}:{' '}
                          <MoneyDisplay
                            amount={signedShare}
                            showSign
                            colored
                            className="text-xs tabular-nums"
                          />
                        </span>
                      </div>
                    </button>
                  );
                }

                // settlement row
                const { batch } = item;
                const label = batch.iMePaying
                  ? t('settlements.you_paid_friend', { name: friend?.displayName ?? '…' })
                  : t('settlements.friend_paid_you', { name: friend?.displayName ?? '…' });

                return (
                  <div
                    key={`settlement-${String(batch.records[0]?.id ?? idx)}`}
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const id = batch.records[0]?.id;
                        if (id)
                          navigate({
                            to: '/settlements/$settlementId',
                            params: { settlementId: String(id) },
                          });
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{label}</p>
                        <p className="text-xs text-muted-foreground">
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
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSettlement(batch)}
                      disabled={deleteSettlement.isPending}
                      aria-label={t('settlements.delete_aria')}
                      className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Remove friend */}
            <div className="mt-5">
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
          </>
        )}

        {!isLoading &&
          feedItems.length === 0 &&
          sharedExpenses.length === 0 &&
          sharedSettlements.length === 0 && (
            <div className="mt-5">
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
