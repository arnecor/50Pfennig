/**
 * pages/ExpenseDetailPage.tsx
 *
 * Route: /expenses/:expenseId
 */

import { cn } from '@/lib/utils';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { PageHeader } from '@components/shared/PageHeader';
import { UserAvatar } from '@components/shared/UserAvatar';
import { isSameCurrency } from '@domain/currency';
import { formatMoney, negate } from '@domain/money';
import type { CurrencyCode } from '@domain/types';
import { type ExpenseId, type Money, type UserId, ZERO } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { expenseByIdQueryOptions } from '@features/expenses/expenseQueries';
import { useDeleteExpense } from '@features/expenses/hooks/useDeleteExpense';
import { useFriends } from '@features/friends/hooks/useFriends';
import { groupDetailQueryOptions } from '@features/groups/groupQueries';
import { useGroups } from '@features/groups/hooks/useGroups';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Trash2, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function ExpenseDetailPage() {
  const { t, i18n } = useTranslation();
  const { expenseId } = useParams({ strict: false }) as { expenseId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;
  const deleteExpense = useDeleteExpense();

  const { data: expense, isLoading } = useQuery(expenseByIdQueryOptions(expenseId as ExpenseId));

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
        const member = group.members.find((m) => (m.userId as string) === userId);
        if (member) return member.displayName;
      }
      for (const g of groups) {
        const member = g.members.find((m) => (m.userId as string) === userId);
        if (member) return member.displayName;
      }
      const friend = friends.find((f) => (f.userId as string) === userId);
      if (friend) return friend.displayName;
      return userId;
    };
  }, [currentUserId, group, groups, friends, t]);

  const contextLabel = useMemo(() => {
    if (!expense) return null;
    if (expense.groupId) return group?.name ?? t('groups.title');
    return t('friends.direct_expense');
  }, [expense, group, t]);

  const splitTypeLabel = useMemo(() => {
    if (!expense) return null;
    switch (expense.split.type) {
      case 'equal':
        return t('expenses.form.split_equal');
      case 'exact':
        return t('expenses.form.split_exact');
      case 'percentage':
        return t('expenses.form.split_percentage');
    }
  }, [expense, t]);

  // My signed share
  const myShare = useMemo((): Money | null => {
    if (!expense || !currentUserId) return null;
    const split = expense.splits.find((s) => (s.userId as string) === (currentUserId as string));
    if (!split) return null;
    const isPayer = (expense.paidBy as string) === (currentUserId as string);
    return isPayer ? ((expense.totalAmount - split.amount) as Money) : negate(split.amount);
  }, [expense, currentUserId]);

  const loadingOrErrorHeader = (title: string) => (
    <div className="min-h-full">
      <PageHeader title={title} onBack={() => window.history.back()} />
    </div>
  );

  if (isLoading) return loadingOrErrorHeader(t('payment_detail.expense_title'));
  if (!expense)
    return (
      <div className="min-h-full">
        <PageHeader
          title={t('payment_detail.expense_title')}
          onBack={() => window.history.back()}
        />
        <div className="flex items-center justify-center px-5 pt-20">
          <p className="text-muted-foreground">{t('common.error_generic')}</p>
        </div>
      </div>
    );

  const paidByName = resolveName(expense.paidBy as string);
  const createdByName = resolveName(expense.createdBy as string);
  const showCreatedBy = (expense.createdBy as string) !== (expense.paidBy as string);
  const isCreator =
    currentUserId != null && (expense.createdBy as string) === (currentUserId as string);

  const handleDelete = () => {
    if (!window.confirm(t('expenses.delete_confirm'))) return;
    deleteExpense.mutate(expense, {
      onSuccess: () => window.history.back(),
    });
  };
  const sharePositive = myShare !== null && myShare >= 0;

  const baseCurrency: CurrencyCode | undefined = group?.baseCurrency;
  const showFxInfo = baseCurrency && !isSameCurrency(expense.currency, baseCurrency);
  const locale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  return (
    <div className="min-h-full pb-10">
      <PageHeader title={t('payment_detail.expense_title')} onBack={() => window.history.back()} />

      <div className="px-5 pt-4 space-y-5">
        {/* Title + context */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">{expense.description}</h2>
          {contextLabel && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              <Users className="w-3 h-3" />
              {contextLabel}
            </span>
          )}
        </div>

        {/* Hero amount card */}
        <div className="rounded-2xl bg-card border border-border px-5 py-5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t('payment_detail.total_amount')}
              </p>
              <MoneyDisplay
                amount={expense.totalAmount}
                currency={expense.currency}
                className="text-3xl font-bold tabular-nums tracking-tight"
              />
            </div>
            {myShare !== null && (
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-2',
                  sharePositive ? 'bg-owed-to-you-muted' : 'bg-you-owe-muted',
                )}
              >
                <div>
                  <p className="text-xs text-muted-foreground leading-none mb-0.5">
                    {sharePositive ? t('friends.you_get') : t('friends.you_owe')}
                  </p>
                  <MoneyDisplay
                    amount={myShare}
                    currency={baseCurrency}
                    showSign
                    colored
                    className="text-base font-bold tabular-nums leading-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* FX conversion info — only when expense currency ≠ base currency */}
          {showFxInfo && (
            <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t('currency.fx_rate_label')}: 1 {baseCurrency as string} ={' '}
                {expense.fxRate.toFixed(2)} {expense.currency as string}
              </p>
              <p className="text-sm font-semibold">
                {t('currency.base_amount_label')}:{' '}
                {formatMoney(expense.baseTotalAmount, locale, baseCurrency as string)}
              </p>
            </div>
          )}

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {t('payment_detail.paid_by', { name: '' }).trim()}
              </p>
              <p className="text-sm font-semibold text-foreground">{paidByName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {expense.createdAt.toLocaleDateString(dateLocale, {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {expense.createdAt.toLocaleTimeString(dateLocale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Split breakdown */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('payment_detail.split_section')}
              {showFxInfo
                ? ` (${t('currency.in_currency', { currency: baseCurrency as string })})`
                : ''}
            </h3>
            <span className="text-xs text-muted-foreground">
              {t('payment_detail.participant_count', { count: expense.splits.length })}
            </span>
          </div>
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {expense.splits.map((split) => {
              const isPayer = (split.userId as string) === (expense.paidBy as string);
              const signedAmount: Money = isPayer
                ? ((expense.totalAmount - split.amount) as Money)
                : negate(split.amount);
              const name = resolveName(split.userId as string);
              const isPos = signedAmount >= 0;
              return (
                <div
                  key={split.userId}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
                >
                  <UserAvatar name={name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{name}</span>
                    {isPayer && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({t('payment_detail.paid_by', { name: '' }).replace('by', '').trim()})
                      </span>
                    )}
                  </div>
                  <MoneyDisplay
                    amount={signedAmount === ZERO ? split.amount : signedAmount}
                    currency={baseCurrency}
                    showSign={signedAmount !== ZERO}
                    colored={signedAmount !== ZERO}
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      signedAmount === ZERO ? '' : isPos ? 'text-owed-to-you' : 'text-you-owe',
                    )}
                  />
                </div>
              );
            })}
            {splitTypeLabel && (
              <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-muted/30">
                {splitTypeLabel}
              </div>
            )}
          </div>
        </div>

        {/* Recorded by */}
        {showCreatedBy && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('payment_detail.recorded_by')}</p>
            <p className="mt-0.5 text-sm font-medium">{createdByName}</p>
          </div>
        )}

        {/* Delete — only visible to creator */}
        {isCreator && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteExpense.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {t('expenses.delete_button')}
          </button>
        )}
      </div>
    </div>
  );
}
