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
import type { GroupId, UserId } from '@domain/types';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import AddMemberOverlay from '@features/groups/components/AddMemberOverlay';
import { useAddGroupMembers } from '@features/groups/hooks/useAddGroupMembers';
import { useGroup } from '@features/groups/hooks/useGroups';
import { useFriends } from '@features/friends/hooks/useFriends';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses, isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: friends = [] } = useFriends();

  const addMembers = useAddGroupMembers();

  const [showMemberOverlay, setShowMemberOverlay] = useState(false);

  const isLoading = groupLoading || expensesLoading;

  const paidByName = useMemo(() => {
    if (!group || !expenses) return (userId: string) => userId;
    return (userId: string) =>
      group.members.find((m) => m.userId === userId)?.displayName ?? userId;
  }, [group, expenses]);

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
          <div className="space-y-3">
            {expenses.map((expense) => (
              <Card key={expense.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{expense.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('expenses.paid_by', {
                          name: paidByName(expense.paidBy),
                        })}
                      </p>
                    </div>
                    <MoneyDisplay
                      amount={expense.totalAmount}
                      className="shrink-0 text-sm font-semibold tabular-nums"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
