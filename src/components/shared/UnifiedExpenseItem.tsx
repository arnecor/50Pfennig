import { cn } from '@/lib/utils';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { UserAvatar } from '@components/shared/UserAvatar';
import type { Money } from '@domain/types';
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
