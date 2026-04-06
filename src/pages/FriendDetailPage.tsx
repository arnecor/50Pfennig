/**
 * pages/FriendDetailPage.tsx
 *
 * Route: /friends/:friendId
 *
 * Shows:
 *   1. Balance summary card — total simplified balance with "Settle Up" button
 *   2. Group breakdown — one row per shared group showing simplified bilateral debt
 *   3. Direct activity feed — only direct (non-group) expenses + all settlements
 *
 * Balance computation:
 *   - Groups: calculateGroupBalances → simplifyDebts → extractSimplifiedDebt per group
 *   - Direct: computeBilateralBalance on friend-only expenses/settlements
 *   This keeps the friend view consistent with what each group page shows.
 */

import { cn } from '@/lib/utils';
import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { PageHeader } from '@components/shared/PageHeader';
import { UnifiedExpenseItem } from '@components/shared/UnifiedExpenseItem';
import { Button } from '@components/ui/button';
import {
  calculateGroupBalances,
  computeBilateralBalance,
  extractSimplifiedDebt,
  simplifyDebts,
} from '@domain/balance';
import { abs, add, formatMoney, isNegative, isPositive, negate, subtract } from '@domain/money';
import type { ContextDebt } from '@domain/settlement';
import { type Money, type Settlement, type UserId, ZERO } from '@domain/types';
import type { Expense, GroupId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import {
  expensesQueryOptions,
  friendExpensesQueryOptions,
} from '@features/expenses/expenseQueries';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useRemoveFriend } from '@features/friends/hooks/useRemoveFriend';
import { useGroups } from '@features/groups/hooks/useGroups';
import RecordFriendSettlementSheet from '@features/settlements/components/RecordFriendSettlementSheet';
import { useDeleteSettlement } from '@features/settlements/hooks/useDeleteSettlement';
import {
  friendSettlementsQueryOptions,
  settlementsQueryOptions,
  sharedSettlementsQueryOptions,
} from '@features/settlements/settlementQueries';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeftRight, Bell, ChevronRight, Receipt, Trash2, UserMinus } from 'lucide-react';
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

  const { data: groups = [], isLoading: groupsLoading } = useGroups();

  // Only groups where both me and the friend are members
  const sharedGroups = useMemo(
    () => groups.filter((g) => g.members.some((m) => (m.userId as string) === friendId)),
    [groups, friendId],
  );

  const groupExpensesResults = useQueries({
    queries: sharedGroups.map((g) => expensesQueryOptions(g.id)),
  });
  const groupSettlementsResults = useQueries({
    queries: sharedGroups.map((g) => settlementsQueryOptions(g.id)),
  });

  // Direct (non-group) expenses and settlements
  const { data: friendExpenses = [], isLoading: friendExpensesLoading } = useQuery(
    friendExpensesQueryOptions(),
  );
  const { data: allFriendSettlements = [], isLoading: friendSettlementsLoading } = useQuery(
    friendSettlementsQueryOptions(),
  );

  // All settlements between the two users (any groupId) — used for the activity feed
  const { data: sharedSettlements = [], isLoading: sharedSettlementsLoading } = useQuery(
    sharedSettlementsQueryOptions(friendId as UserId),
  );

  const isLoading =
    groupsLoading ||
    friendExpensesLoading ||
    friendSettlementsLoading ||
    sharedSettlementsLoading ||
    groupExpensesResults.some((r) => r.isLoading) ||
    groupSettlementsResults.some((r) => r.isLoading);

  const removeFriend = useRemoveFriend();
  const deleteSettlement = useDeleteSettlement();
  const [showSettleSheet, setShowSettleSheet] = useState(false);

  // Direct expenses and settlements between the two users
  const directExpenses = useMemo(() => {
    if (!friend) return [];
    const friendIdStr = friend.userId as string;
    return friendExpenses.filter(
      (e) =>
        (e.paidBy as string) === friendIdStr ||
        e.splits.some((s) => (s.userId as string) === friendIdStr),
    );
  }, [friendExpenses, friend]);

  const directSettlements = useMemo(() => {
    if (!friend) return [];
    const friendIdStr = friend.userId as string;
    return allFriendSettlements.filter(
      (s) => (s.fromUserId as string) === friendIdStr || (s.toUserId as string) === friendIdStr,
    );
  }, [allFriendSettlements, friend]);

  // Per-group simplified debts + direct balance
  const { netBalance, perGroupBreakdown, contextDebts } = useMemo(() => {
    if (!currentUserId || !friend) {
      return { netBalance: ZERO, perGroupBreakdown: [], contextDebts: [] };
    }

    let total: Money = ZERO;
    const breakdown: Array<{ groupId: GroupId; groupName: string; amount: Money }> = [];
    const debts: ContextDebt[] = [];

    for (let i = 0; i < sharedGroups.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: loop bound guarantees i is in range
      const group = sharedGroups[i]!;
      const groupExpenses = groupExpensesResults[i]?.data ?? [];
      const groupSettlements = groupSettlementsResults[i]?.data ?? [];

      const balanceMap = calculateGroupBalances(groupExpenses, groupSettlements, group.members);
      const instructions = simplifyDebts(balanceMap);
      const amount = extractSimplifiedDebt(instructions, currentUserId, friend.userId);

      breakdown.push({ groupId: group.id, groupName: group.name, amount });
      if (amount !== ZERO) {
        debts.push({ groupId: group.id, amount });
      }
      total = add(total, amount);
    }

    // Direct bilateral balance
    const directBalance = computeBilateralBalance(
      directExpenses,
      directSettlements,
      currentUserId,
      friend.userId,
    );
    if (directBalance !== ZERO) {
      debts.push({ groupId: null, amount: directBalance });
    }
    total = add(total, directBalance);

    return { netBalance: total, perGroupBreakdown: breakdown, contextDebts: debts };
  }, [
    currentUserId,
    friend,
    sharedGroups,
    groupExpensesResults,
    groupSettlementsResults,
    directExpenses,
    directSettlements,
  ]);

  // Activity feed: direct expenses only + all shared settlements
  const feedItems = useMemo((): FeedItem[] => {
    const items: FeedItem[] = directExpenses.map((e) => ({ kind: 'expense' as const, data: e }));

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
  }, [directExpenses, sharedSettlements, currentUserId]);

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

  const hasGroupShares = sharedGroups.length > 0;
  const hasActivity = feedItems.length > 0;
  const hasContent = hasGroupShares || hasActivity;

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

        {!isLoading && !hasContent && (
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title={t('friends.no_shared_expenses')}
            description={t('friends.no_shared_expenses_description')}
          />
        )}

        {!isLoading && hasContent && (
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

            {/* Group breakdown */}
            {hasGroupShares && (
              <div className="mb-5">
                <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                  {t('friends.group_breakdown')}
                </p>
                <div className="bg-card rounded-2xl border border-border overflow-hidden px-4">
                  {perGroupBreakdown.map((row, idx) => (
                    <button
                      key={String(row.groupId)}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/groups/$groupId',
                          params: { groupId: String(row.groupId) },
                        })
                      }
                      className={cn(
                        'flex items-center w-full py-3 gap-3 text-left hover:opacity-80 transition-opacity',
                        idx < perGroupBreakdown.length - 1 ? 'border-b border-border' : '',
                      )}
                    >
                      <span className="flex-1 text-sm font-medium truncate">{row.groupName}</span>
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums shrink-0',
                          row.amount === ZERO
                            ? 'text-muted-foreground'
                            : isPositive(row.amount)
                              ? 'text-owed-to-you'
                              : 'text-you-owe',
                        )}
                      >
                        {row.amount === ZERO
                          ? t('friends.balanced')
                          : `${isPositive(row.amount) ? '+' : ''}${formatMoney(row.amount)}`}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Direct activity feed */}
            {hasActivity && (
              <>
                <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                  {t('friends.direct_expenses')}
                </p>
                {(() => {
                  const now = new Date();
                  const yesterday = new Date(now);
                  yesterday.setDate(now.getDate() - 1);

                  const isSameDay = (a: Date, b: Date) =>
                    a.getFullYear() === b.getFullYear() &&
                    a.getMonth() === b.getMonth() &&
                    a.getDate() === b.getDate();

                  const getDateLabel = (date: Date) => {
                    if (isSameDay(date, now)) return t('common.today');
                    if (isSameDay(date, yesterday)) return t('common.yesterday');
                    return date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' });
                  };

                  const dateGroups: { label: string; items: FeedItem[] }[] = [];
                  let currentLabel = '';
                  for (const item of feedItems) {
                    const date = item.kind === 'expense' ? item.data.createdAt : item.batch.date;
                    const label = getDateLabel(date);
                    if (label !== currentLabel) {
                      dateGroups.push({ label, items: [item] });
                      currentLabel = label;
                    } else {
                      const lastGroup = dateGroups[dateGroups.length - 1];
                      if (lastGroup) lastGroup.items.push(item);
                    }
                  }

                  return dateGroups.map((group, groupIdx) => (
                    <div key={group.label}>
                      <p
                        className={`px-1 pb-1 text-xs font-medium text-muted-foreground ${groupIdx === 0 ? '' : 'pt-4'}`}
                      >
                        {group.label}
                      </p>
                      <div className="bg-card rounded-2xl border border-border overflow-hidden px-4">
                        {group.items.map((item, idx) => {
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
                                    ? (expense.splits.find((s) => s.userId === currentUserId)
                                        ?.amount ?? ZERO)
                                    : ZERO,
                                );

                            return (
                              <UnifiedExpenseItem
                                key={`expense-${String(expense.id)}`}
                                description={expense.description}
                                paidByName={paidByName}
                                totalAmount={expense.totalAmount}
                                shareAmount={signedShare}
                                paidByCurrentUser={paidByCurrentUser}
                                onClick={() =>
                                  navigate({
                                    to: '/expenses/$expenseId',
                                    params: { expenseId: String(expense.id) },
                                  })
                                }
                              />
                            );
                          }

                          // settlement row
                          const { batch } = item;
                          const label = batch.iMePaying
                            ? t('settlements.you_paid_friend', {
                                name: friend?.displayName ?? '…',
                              })
                            : t('settlements.friend_paid_you', {
                                name: friend?.displayName ?? '…',
                              });

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
                                  {batch.note && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {batch.note}
                                    </p>
                                  )}
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
                    </div>
                  ));
                })()}
              </>
            )}

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

        {!isLoading && !hasContent && (
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
          contextDebts={contextDebts}
          onClose={() => setShowSettleSheet(false)}
        />
      )}
    </div>
  );
}
