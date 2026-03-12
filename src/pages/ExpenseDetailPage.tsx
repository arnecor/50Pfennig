/**
 * pages/ExpenseDetailPage.tsx
 *
 * Route: /expenses/:expenseId
 *
 * Shows all details of a single expense:
 *   - Description, context (group or direct), total amount
 *   - Paid by, exact date/time
 *   - Per-participant split breakdown with signed amounts
 *   - Split type label
 *   - "Erfasst von" (created by) when createdBy differs from paidBy
 */

import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { negate } from '@domain/money';
import { ZERO, type ExpenseId, type Money, type UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { expenseByIdQueryOptions } from '@features/expenses/expenseQueries';
import { useFriends } from '@features/friends/hooks/useFriends';
import { groupDetailQueryOptions } from '@features/groups/groupQueries';
import { useGroups } from '@features/groups/hooks/useGroups';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function ExpenseDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { expenseId } = useParams({ strict: false }) as { expenseId: string };

  const currentUserId = useAuthStore(s => s.session?.user.id) as UserId | undefined;

  const { data: expense, isLoading } = useQuery(
    expenseByIdQueryOptions(expenseId as ExpenseId),
  );

  const groupId = expense?.groupId ?? null;
  const { data: group } = useQuery({
    ...groupDetailQueryOptions(groupId as never),
    enabled: !!groupId,
  });
  const { data: groups = [] } = useGroups();
  const { data: friends = [] } = useFriends();

  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const resolveName = useMemo(() => {
    return (userId: string): string => {
      if (currentUserId && userId === (currentUserId as string)) return t('common.you');
      if (group) {
        const member = group.members.find(m => (m.userId as string) === userId);
        if (member) return member.displayName;
      }
      for (const g of groups) {
        const member = g.members.find(m => (m.userId as string) === userId);
        if (member) return member.displayName;
      }
      const friend = friends.find(f => (f.userId as string) === userId);
      if (friend) return friend.displayName;
      return userId;
    };
  }, [currentUserId, group, groups, friends, t]);

  const contextLabel = useMemo(() => {
    if (!expense) return null;
    if (expense.groupId) {
      return group?.name ?? t('groups.title');
    }
    return t('friends.direct_expense');
  }, [expense, group, t]);

  const splitTypeLabel = useMemo(() => {
    if (!expense) return null;
    switch (expense.split.type) {
      case 'equal':      return t('expenses.form.split_equal');
      case 'exact':      return t('expenses.form.split_exact');
      case 'percentage': return t('expenses.form.split_percentage');
    }
  }, [expense, t]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="flex items-center gap-3 border-b px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: -1 as never })} aria-label={t('common.back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{t('payment_detail.expense_title')}</h1>
        </header>
        <div className="flex-1 px-4 py-6 space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="flex items-center gap-3 border-b px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: -1 as never })} aria-label={t('common.back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{t('payment_detail.expense_title')}</h1>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-muted-foreground">{t('common.error_generic')}</p>
        </div>
      </div>
    );
  }

  const paidByName = resolveName(expense.paidBy as string);
  const createdByName = resolveName(expense.createdBy as string);
  const showCreatedBy = (expense.createdBy as string) !== (expense.paidBy as string);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: -1 as never })} aria-label={t('common.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('payment_detail.expense_title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Title + context */}
        <div>
          <h2 className="text-xl font-bold">{expense.description}</h2>
          {contextLabel && (
            <span className="mt-1 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {contextLabel}
            </span>
          )}
        </div>

        {/* Amount block */}
        <div className="rounded-lg bg-muted/50 px-4 py-4 space-y-2">
          <MoneyDisplay
            amount={expense.totalAmount}
            className="text-3xl font-bold tabular-nums"
          />
          <p className="text-sm text-muted-foreground">
            {t('payment_detail.paid_by', { name: paidByName })}
          </p>
          <p className="text-xs text-muted-foreground">
            {expense.createdAt.toLocaleDateString(dateLocale, {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
            {', '}
            {expense.createdAt.toLocaleTimeString(dateLocale, {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' '}
            {t('payment_detail.time_suffix')}
          </p>
        </div>

        {/* Split breakdown */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">{t('payment_detail.split_section')}</h3>
            <span className="text-xs text-muted-foreground">
              {t('payment_detail.participant_count', { count: expense.splits.length })}
            </span>
          </div>
          <div className="rounded-lg border divide-y">
            {expense.splits.map(split => {
              const isPayer = (split.userId as string) === (expense.paidBy as string);
              const signedAmount: Money = isPayer
                ? ((expense.totalAmount - split.amount) as Money)
                : negate(split.amount);
              const name = resolveName(split.userId as string);
              return (
                <div key={split.userId} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">{name}</span>
                  <MoneyDisplay
                    amount={signedAmount === ZERO ? split.amount : signedAmount}
                    showSign={signedAmount !== ZERO}
                    colored={signedAmount !== ZERO}
                    className="text-sm font-semibold tabular-nums"
                  />
                </div>
              );
            })}
            {splitTypeLabel && (
              <div className="px-4 py-2 text-center text-xs text-muted-foreground">
                {splitTypeLabel}
              </div>
            )}
          </div>
        </div>

        {/* Erfasst von — only shown when createdBy ≠ paidBy */}
        {showCreatedBy && (
          <div className="rounded-lg border px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('payment_detail.recorded_by')}</p>
            <p className="mt-0.5 text-sm">{createdByName}</p>
          </div>
        )}
      </div>
    </div>
  );
}
