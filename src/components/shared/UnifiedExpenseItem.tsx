import { cn } from '@/lib/utils';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import type { Money } from '@domain/types';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type UnifiedExpenseItemProps = {
  description: string;
  paidByName: string;
  totalAmount: Money;
  /** Signed: positive = owed to you, negative = you owe. */
  shareAmount: Money;
  /** Controls icon direction: TrendingUp if true, TrendingDown if false. */
  paidByCurrentUser: boolean;
  /** Optional group name appended to the subtitle — used by the home feed. */
  groupName?: string;
  onClick?: () => void;
  className?: string;
};

export function UnifiedExpenseItem({
  description,
  paidByName,
  totalAmount,
  shareAmount,
  paidByCurrentUser,
  groupName,
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        {paidByCurrentUser ? (
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{description}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>

      <div className="shrink-0 text-right">
        <MoneyDisplay amount={totalAmount} className="block text-sm font-semibold tabular-nums" />
        <span className="text-xs text-muted-foreground">
          {t('expenses.my_share')}:{' '}
          <MoneyDisplay amount={shareAmount} showSign colored className="text-xs tabular-nums" />
        </span>
      </div>
    </button>
  );
}
