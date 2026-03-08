/**
 * pages/GroupDetailPage.tsx
 *
 * Route: /groups/:groupId
 *
 * Shows group name, expense list, and controls for:
 *   - Adding a new expense (floating action button at the bottom)
 *   - Managing members / sharing the group (secondary button in header)
 */

import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { calculateGroupBalances } from '@domain/balance';
import { add, isPositive, negate } from '@domain/money';
import { ZERO, type GroupId, type Money, type UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useFriends } from '@features/friends/hooks/useFriends';
import AddMemberOverlay from '@features/groups/components/AddMemberOverlay';
import { useAddGroupMembers } from '@features/groups/hooks/useAddGroupMembers';
import { useGroup } from '@features/groups/hooks/useGroups';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Plus, Receipt, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
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

export default function GroupDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const currentUserId = useAuthStore(s => s.session?.user.id) as UserId | undefined;

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses, isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(groupId as GroupId);
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

  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const handleAddExpense = () => {
    navigate({ to: '/expenses/new', search: { groupId } });
  };

  const handleBack = () => {
    navigate({ to: '/groups' });
  };

  function handleAddMembers(userIds: UserId[]) {
    if (!group) return;
    addMembers.mutate(
      { groupId: group.id, userIds },
      { onSuccess: () => setShowMemberOverlay(false) },
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label={t('common.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold">{groupLoading ? '…' : group?.name}</h1>
          {group && (
            <p className="text-xs text-muted-foreground">
              {group.members.length} {t('groups.members')}
            </p>
          )}
        </div>
        {/* "+ Mitglieder" — secondary so it doesn't steal attention from the FAB */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowMemberOverlay(true)}
          className="gap-1.5 shrink-0"
          disabled={groupLoading}
        >
          <UserPlus className="h-4 w-4" />
          {t('groups.manage_members')}
        </Button>
      </header>

      {/* Expense list — extra bottom padding so content isn't hidden behind the FAB */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        {isLoading && (
          <div className="space-y-3">
            <ExpenseSkeleton />
            <ExpenseSkeleton />
            <ExpenseSkeleton />
          </div>
        )}

        {!isLoading && expenses && expenses.length === 0 && (
          <EmptyState
            icon={<Receipt className="h-12 w-12" />}
            title={t('expenses.empty_title')}
            description={t('expenses.empty_description')}
            action={
              <Button onClick={handleAddExpense} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('expenses.add')}
              </Button>
            }
          />
        )}

        {!isLoading && expenses && expenses.length > 0 && (
          <>
            {/* Balance summary */}
            <div className="mb-4 rounded-lg bg-muted/50 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                {/* Total group spending */}
                <div className="text-center flex-1">
                  <p className="mb-1 text-xs text-muted-foreground">{t('groups.total_spent')}</p>
                  <MoneyDisplay
                    amount={totalGroupSpending}
                    colored={false}
                    className="text-lg font-bold tabular-nums"
                  />
                </div>

                <div className="w-px self-stretch bg-border" />

                {/* Current user's net balance */}
                <div className="text-center flex-1">
                  {netBalance === ZERO ? (
                    <p className="text-sm font-semibold">{t('groups.balanced')}</p>
                  ) : (
                    <>
                      <p className="mb-1 text-xs text-muted-foreground">
                        {isPositive(netBalance)
                          ? t('groups.group_owes_you')
                          : t('groups.you_owe_group')}
                      </p>
                      <MoneyDisplay
                        amount={netBalance}
                        showSign
                        colored={false}
                        className="text-lg font-bold tabular-nums"
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: '/groups/$groupId/settlements', params: { groupId } })
                    }
                    className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    {t('settlements.view_settlements')} →
                  </button>
                </div>
              </div>
            </div>

            {/* Expense list */}
            <div className="space-y-3">
              {expenses.map((expense) => {
                const paidByCurrentUser =
                  (expense.paidBy as string) === (currentUserId as string);
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
                            {paidByName(expense.paidBy)}
                            {participantCount > 2 && (
                              <> · {t('groups.participant_count', { count: participantCount })}</>
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
                            {t('groups.total')}{' '}
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

      {/* Floating action button — fixed above the bottom nav */}
      <div
        className="fixed left-0 right-0 z-10 flex justify-center px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem + 0.75rem)' }}
      >
        <Button
          size="lg"
          onClick={handleAddExpense}
          className="gap-2 rounded-full px-6 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          {t('expenses.add')}
        </Button>
      </div>

      {/* Add member overlay */}
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
