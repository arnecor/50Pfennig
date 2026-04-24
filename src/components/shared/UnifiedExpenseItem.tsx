import { cn } from '@/lib/utils';
import PendingSyncMarker from '@components/PendingSyncMarker';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { UserAvatar } from '@components/shared/UserAvatar';
import type { CurrencyCode, Money } from '@domain/types';
import { useTranslation } from 'react-i18next';

type UnifiedExpenseItemProps = {
  description: string;
  paidByName: string;
  paidByAvatarUrl?: string | undefined;
  totalAmount: Money;
  /** Signed: positive = owed to you, negative = you owe. */
  shareAmount: Money;
  /** Kept for callers — previously controlled arrow direction. */
  paidByCurrentUser?: boolean;
  /** Optional group name appended to the subtitle — used by the home feed. */
  groupName?: string;
  /**
   * Expense id used to look up whether this row has a pending offline
   * write. When a matching item exists in the queue we show a small
   * clock/warning marker next to the description.
   */
  expenseId?: string;
  /** Currency of the original expense amount (e.g. THB). */
  currency?: CurrencyCode;
  /** Base currency for the share amount (e.g. EUR). */
  baseCurrency?: CurrencyCode;
  onClick?: () => void;
  className?: string;
};

export function UnifiedExpenseItem({
  description,
  paidByName,
  paidByAvatarUrl,
  totalAmount,
  shareAmount,
  groupName,
  expenseId,
  currency,
  baseCurrency,
  onClick,
  className,
}: UnifiedExpenseItemProps) {
  const { t } = useTranslation();

  const subtitle = groupName
    ? `${t('expenses.paid_by_short')}: ${paidByName} · ${groupName}`
    : `${t('expenses.paid_by_short')}: ${paidByName}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-left px-1',
        className,
      )}
    >
      <UserAvatar name={paidByName} avatarUrl={paidByAvatarUrl} size="sm" />

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground flex items-center gap-1.5">
          <span className="truncate">{description}</span>
          {expenseId ? <PendingSyncMarker id={expenseId} /> : null}
        </p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>

      <div className="shrink-0 text-right">
        <MoneyDisplay amount={totalAmount} currency={currency} className="block text-sm font-semibold tabular-nums" />
        <span className="text-xs text-muted-foreground">
          {t('expenses.my_share')}:{' '}
          <MoneyDisplay amount={shareAmount} currency={baseCurrency} showSign colored className="text-xs tabular-nums" />
        </span>
      </div>
    </button>
  );
}
