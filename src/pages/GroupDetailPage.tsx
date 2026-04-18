/**
 * pages/GroupDetailPage.tsx
 *
 * Route: /groups/:groupId
 *
 * Shows group name, expense list, and controls for:
 *   - Adding a new expense (floating action button at the bottom)
 *   - Managing members / sharing the group (secondary button in header)
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import EmptyState from '@components/shared/EmptyState';
import { FloatingActionButton } from '@components/shared/FloatingActionButton';
import { GroupAvatar } from '@components/shared/GroupAvatar';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { PageHeader } from '@components/shared/PageHeader';
import { UnifiedExpenseItem } from '@components/shared/UnifiedExpenseItem';
import { calculateGroupBalances } from '@domain/balance';
import { add, formatMoney, isPositive, isZero, negate } from '@domain/money';
import {
  type Expense,
  type GroupEvent,
  type GroupId,
  type Money,
  type Settlement,
  type UserId,
  ZERO,
} from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useFriends } from '@features/friends/hooks/useFriends';
import AddMemberOverlay from '@features/groups/components/AddMemberOverlay';
import { useAddGroupMembers } from '@features/groups/hooks/useAddGroupMembers';
import { useGroupEvents } from '@features/groups/hooks/useGroupEvents';
import { useGroup } from '@features/groups/hooks/useGroups';
import { useUnarchiveGroup } from '@features/groups/hooks/useUnarchiveGroup';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Archive, ArchiveRestore, ArrowLeftRight, Receipt, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type ActivityExpense = { kind: 'expense'; data: Expense };
type ActivitySettlement = { kind: 'settlement'; data: Settlement };
type ActivityEvent = { kind: 'event'; data: GroupEvent };
type GroupActivityItem = ActivityExpense | ActivitySettlement | ActivityEvent;

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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function GroupDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;
  const currentUserAvatarUrl: string | undefined = useAuthStore(
    (s) => s.session?.user.user_metadata?.avatar_url,
  );

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses, isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(
    groupId as GroupId,
  );
  const { data: friends = [] } = useFriends();
  const { data: groupEvents = [] } = useGroupEvents(groupId as GroupId);

  const addMembers = useAddGroupMembers();
  const unarchiveGroup = useUnarchiveGroup();
  const [showMemberOverlay, setShowMemberOverlay] = useState(false);

  const isLoading = groupLoading || expensesLoading || settlementsLoading;

  const resolveName = useMemo(() => {
    if (!group || !expenses) return (userId: string) => userId;
    return (userId: string) => {
      if (currentUserId && userId === (currentUserId as string)) return t('common.you');
      return group.members.find((m) => m.userId === userId)?.displayName ?? userId;
    };
  }, [group, expenses, currentUserId, t]);

  const resolveAvatarUrl = useMemo(() => {
    if (!group) return (_userId: string) => undefined as string | undefined;
    return (userId: string): string | undefined => {
      if (currentUserId && userId === (currentUserId as string)) return currentUserAvatarUrl;
      return group.members.find((m) => m.userId === userId)?.avatarUrl;
    };
  }, [group, currentUserId, currentUserAvatarUrl]);

  const netBalance = useMemo(() => {
    if (!currentUserId || !group || !expenses) return ZERO;
    return calculateGroupBalances(expenses, settlements, group.members).get(currentUserId) ?? ZERO;
  }, [expenses, settlements, group, currentUserId]);

  const totalGroupSpending = useMemo(() => {
    if (!expenses) return ZERO;
    return expenses.reduce((sum, e) => add(sum, e.totalAmount), ZERO);
  }, [expenses]);

  const allItems = useMemo((): GroupActivityItem[] => {
    const expenseItems: ActivityExpense[] = (expenses ?? []).map((e) => ({
      kind: 'expense',
      data: e,
    }));
    const settlementItems: ActivitySettlement[] = settlements.map((s) => ({
      kind: 'settlement',
      data: s,
    }));
    const eventItems: ActivityEvent[] = groupEvents.map((ev) => ({
      kind: 'event',
      data: ev,
    }));
    return [...expenseItems, ...settlementItems, ...eventItems].sort(
      (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
    );
  }, [expenses, settlements, groupEvents]);

  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const dateGroups = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const getDateLabel = (date: Date) => {
      if (isSameDay(date, now)) return t('common.today');
      if (isSameDay(date, yesterday)) return t('common.yesterday');
      return date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' });
    };

    const groups: { label: string; items: GroupActivityItem[] }[] = [];
    let currentLabel = '';
    for (const item of allItems) {
      const label = getDateLabel(item.data.createdAt);
      if (label !== currentLabel) {
        groups.push({ label, items: [item] });
        currentLabel = label;
      } else {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup) lastGroup.items.push(item);
      }
    }
    return groups;
  }, [allItems, t, dateLocale]);

  const handleAddExpense = () => navigate({ to: '/expenses/new', search: { groupId } });
  const handleBack = () => navigate({ to: '/groups' });
  const handleOpenSettings = () =>
    navigate({ to: '/groups/$groupId/settings', params: { groupId } });

  function handleAddMembers(userIds: UserId[]) {
    if (!group) return;
    addMembers.mutate(
      { groupId: group.id, userIds },
      { onSuccess: () => setShowMemberOverlay(false) },
    );
  }

  const balanceSettled = isZero(netBalance);
  const balancePositive = isPositive(netBalance);

  const isArchived = group?.isArchived ?? false;

  return (
    <div className="min-h-full pb-24">
      <PageHeader
        title={groupLoading ? '…' : (group?.name ?? '')}
        {...(group && { subtitle: `${group.members.length} ${t('groups.members')}` })}
        {...(group && { onSubtitleClick: handleOpenSettings })}
        onBack={handleBack}
        avatar={<GroupAvatar imageUrl={group?.imageUrl} groupName={group?.name ?? ''} size="sm" />}
        onAvatarClick={handleOpenSettings}
        {...(!isArchived && {
          onAction: () => setShowMemberOverlay(true),
          actionIcon: <UserPlus className="w-5 h-5" />,
          actionLabel: t('groups.manage_members'),
        })}
      />

      <div className="px-5">
        {isLoading && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden px-4 mb-5">
            <ItemSkeleton />
            <ItemSkeleton />
            <ItemSkeleton />
          </div>
        )}

        {!isLoading && allItems.length === 0 && (
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title={t('expenses.empty_title')}
            description={t('expenses.empty_description')}
            action={
              !isArchived ? (
                <button
                  type="button"
                  onClick={handleAddExpense}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {t('expenses.add')}
                </button>
              ) : undefined
            }
          />
        )}

        {!isLoading && allItems.length > 0 && (
          <>
            {/* Archive banner — shown instead of balance summary for archived groups */}
            {isArchived && (
              <div className="bg-muted border border-border rounded-2xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <Archive className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-muted-foreground">
                    {t('groups.archived_banner_title')}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('groups.archived_banner_body')}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => unarchiveGroup.mutate(groupId as GroupId)}
                  disabled={unarchiveGroup.isPending}
                >
                  <ArchiveRestore className="w-4 h-4" />
                  {unarchiveGroup.isPending ? t('common.loading') : t('groups.reactivate')}
                </Button>
              </div>
            )}

            {/* Balance summary card — only for active groups */}
            {!isArchived && (
              <div className="bg-card rounded-2xl border border-border p-5 mb-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('groups.total_spent')}</p>
                    <MoneyDisplay
                      amount={totalGroupSpending}
                      colored={false}
                      className="text-xl font-bold tabular-nums"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">
                      {balanceSettled
                        ? t('groups.balanced')
                        : balancePositive
                          ? t('groups.group_owes_you')
                          : t('groups.you_owe_group')}
                    </p>
                    <p
                      className={cn(
                        'text-xl font-bold',
                        balanceSettled
                          ? 'text-muted-foreground'
                          : balancePositive
                            ? 'text-owed-to-you'
                            : 'text-you-owe',
                      )}
                    >
                      {balanceSettled
                        ? '—'
                        : `${balancePositive ? '+' : ''}${formatMoney(netBalance)}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate({ to: '/groups/$groupId/balances', params: { groupId } })}
                  className="mt-4 w-full"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {t('balances.who_owes_whom_link')}
                </Button>
              </div>
            )}

            {/* Activity list grouped by date */}
            {dateGroups.map((group, groupIdx) => (
              <div key={group.label}>
                <p
                  className={`px-1 pb-1 text-xs font-medium text-muted-foreground ${groupIdx === 0 ? '' : 'pt-4'}`}
                >
                  {group.label}
                </p>
                <div className="bg-card rounded-2xl border border-border overflow-hidden px-4 mb-0">
                  {group.items.map((item) => {
                    if (item.kind === 'expense') {
                      const expense = item.data;
                      const paidByCurrentUser =
                        (expense.paidBy as string) === (currentUserId as string);
                      const myShare = currentUserId
                        ? (expense.splits.find((s) => s.userId === currentUserId)?.amount ?? ZERO)
                        : ZERO;
                      const signedShare = paidByCurrentUser
                        ? ((expense.totalAmount - myShare) as Money)
                        : negate(myShare);

                      return (
                        <UnifiedExpenseItem
                          key={expense.id}
                          description={expense.description}
                          paidByName={resolveName(expense.paidBy)}
                          paidByAvatarUrl={resolveAvatarUrl(expense.paidBy)}
                          totalAmount={expense.totalAmount}
                          shareAmount={signedShare}
                          paidByCurrentUser={paidByCurrentUser}
                          expenseId={String(expense.id)}
                          onClick={() =>
                            navigate({
                              to: '/expenses/$expenseId',
                              params: { expenseId: String(expense.id) },
                            })
                          }
                        />
                      );
                    }

                    // event row (member joined / left)
                    if (item.kind === 'event') {
                      const ev = item.data;
                      const isJoin = ev.eventType === 'member_joined';
                      const label = isJoin
                        ? t('groups.event_member_joined', { name: ev.displayName })
                        : t('groups.event_member_left', { name: ev.displayName });
                      return (
                        <div
                          key={ev.id}
                          className="flex items-center gap-3 py-3 border-b border-border last:border-0 px-1"
                        >
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground truncate">{label}</p>
                            <p className="text-xs text-muted-foreground">
                              {ev.createdAt.toLocaleDateString(dateLocale, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // settlement row
                    const s = item.data;
                    const payerName = resolveName(s.fromUserId);
                    const payeeName = resolveName(s.toUserId);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          navigate({
                            to: '/settlements/$settlementId',
                            params: { settlementId: String(s.id) },
                          })
                        }
                        className="w-full flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-left px-1"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground truncate">
                            {t('groups.activity_settlement', {
                              payer: payerName,
                              payee: payeeName,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.createdAt.toLocaleDateString(dateLocale, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <MoneyDisplay
                          amount={s.amount}
                          colored={false}
                          className="shrink-0 text-sm tabular-nums text-muted-foreground"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {!isArchived && <FloatingActionButton onClick={handleAddExpense} label={t('expenses.add')} />}

      {showMemberOverlay && group && (
        <AddMemberOverlay
          group={group}
          friends={friends}
          onAddMembers={handleAddMembers}
          isPending={addMembers.isPending}
          onClose={() => setShowMemberOverlay(false)}
        />
      )}
    </div>
  );
}
