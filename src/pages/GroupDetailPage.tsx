/**
 * pages/GroupDetailPage.tsx
 *
 * Route: /groups/:groupId
 *
 * Shows group name, expense list, and a button to add a new expense.
 * Full balance + settlement sections are out of scope for this ticket.
 */

import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import type { GroupId } from '@domain/types';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useGroup } from '@features/groups/hooks/useGroups';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Plus, Receipt } from 'lucide-react';
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

export default function GroupDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses, isLoading: expensesLoading } = useExpenses(groupId as GroupId);

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
        <Button size="sm" onClick={handleAddExpense} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          {t('expenses.add')}
        </Button>
      </header>

      {/* Expense list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
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
    </div>
  );
}
