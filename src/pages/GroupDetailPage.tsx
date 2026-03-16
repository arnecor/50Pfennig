/**
 * pages/GroupDetailPage.tsx
 *
 * Route: /groups/:groupId
 *
 * Shows group name, expense list, and controls for:
 *   - Adding a new expense (floating action button at the bottom)
 *   - Managing members / sharing the group (secondary button in header)
 */

import { cn } from '@/lib/utils';
import EmptyState from '@components/shared/EmptyState';
import { FloatingActionButton } from '@components/shared/FloatingActionButton';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { PageHeader } from '@components/shared/PageHeader';
import { calculateGroupBalances } from '@domain/balance';
import { add, formatMoney, isNegative, isPositive, isZero, negate } from '@domain/money';
import {
  type Expense,
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
import { useGroup } from '@features/groups/hooks/useGroups';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeftRight, Receipt, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type ActivityExpense = { kind: 'expense'; data: Expense };
type ActivitySettlement = { kind: 'settlement'; data: Settlement };
type GroupActivityItem = ActivityExpense | ActivitySettlement;

function ItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0 px-1">
      <div className="w-10 h-10 rounded-lg bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-16 animate-pulse rounded bg-muted shrink-0" />
    </div>
  );
}

export default function GroupDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses, isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(
    groupId as GroupId,
  );
  const { data: friends = [] } = useFriends();

  const addMembers = useAddGroupMembers();
  const [showMemberOverlay, setShowMemberOverlay] = useState(false);

  const isLoading = groupLoading || expensesLoading || settlementsLoading;

  const paidByName = useMemo(() => {
    if (!group || !expenses) return (userId: string) => userId;
    return (userId: string) => {
      if (currentUserId && userId === (currentUserId as string)) return t('common.you');
      return group.members.find((m) => m.userId === userId)?.displayName ?? userId;
    };
  }, [group, expenses, currentUserId, t]);

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
    return [...expenseItems, ...settlementItems].sort(
      (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
    );
  }, [expenses, settlements]);

  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const handleAddExpense = () => navigate({ to: '/expenses/new', search: { groupId } });
  const handleBack = () => navigate({ to: '/groups' });

  function handleAddMembers(userIds: UserId[]) {
    if (!group) return;
    addMembers.mutate(
      { groupId: group.id, userIds },
      { onSuccess: () => setShowMemberOverlay(false) },
    );
  }

  const balanceSettled = isZero(netBalance);
  const balancePositive = isPositive(netBalance);

  return (
    <div className="min-h-full pb-24">
      <PageHeader
        title={groupLoading ? '…' : (group?.name ?? '')}
        {...(group && { subtitle: `${group.members.length} ${t('groups.members')}` })}
        onBack={handleBack}
        onAction={() => setShowMemberOverlay(true)}
        actionIcon={<UserPlus className="w-5 h-5" />}
        actionLabel={t('groups.manage_members')}
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
              <button
                type="button"
                onClick={handleAddExpense}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {t('expenses.add')}
              </button>
            }
          />
        )}

        {!isLoading && allItems.length > 0 && (
          <>
            {/* Balance summary card */}
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

              <button
                type="button"
                onClick={() =>
                  navigate({ to: '/groups/$groupId/settlements', params: { groupId } })
                }
                className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {t('settlements.view_settlements')} →
              </button>
            </div>

            {/* Activity list */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden px-4">
              {allItems.map((item) => {
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
                  const signedPositive = !isNegative(signedShare);

                  return (
                    <button
                      key={expense.id}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/expenses/$expenseId',
                          params: { expenseId: String(expense.id) },
                        })
                      }
                      className="w-full flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-left px-1"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {expense.description}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {paidByName(expense.paidBy)}
                          {' · '}
                          {expense.createdAt.toLocaleDateString(dateLocale, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            signedPositive ? 'text-owed-to-you' : 'text-you-owe',
                          )}
                        >
                          {signedPositive ? '+' : ''}
                          {formatMoney(signedShare)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('groups.total')} {formatMoney(expense.totalAmount)}
                        </p>
                      </div>
                    </button>
                  );
                }

                // settlement row
                const s = item.data;
                const payerName = paidByName(s.fromUserId);
                const payeeName = paidByName(s.toUserId);
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
                        {t('groups.activity_settlement', { payer: payerName, payee: payeeName })}
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
          </>
        )}
      </div>

      <FloatingActionButton onClick={handleAddExpense} label={t('expenses.add')} />

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
