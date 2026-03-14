import { cn } from '@/lib/utils';
import { formatMoney, isNegative, isZero } from '@domain/money';
import type { Money } from '@domain/types';
import { UserAvatar } from '@components/shared/UserAvatar';
import { format } from 'date-fns';

type UnifiedExpenseItemProps = {
  description: string;
  paidByName: string;
  date: Date;
  groupName?: string;
  totalAmount: Money;
  /** Positive = owed to you, negative = you owe. */
  netAmount: Money;
  onClick?: () => void;
  className?: string;
};

export function UnifiedExpenseItem({
  description,
  paidByName,
  date,
  groupName,
  totalAmount,
  netAmount,
  onClick,
  className,
}: UnifiedExpenseItemProps) {
  const positive = !isNegative(netAmount);
  const zero = isZero(netAmount);

  const subtitleParts = [paidByName, format(date, 'dd.MM.yy')];
  if (groupName) {
    subtitleParts.push(groupName);
  }
  const subtitle = subtitleParts.join(' \u00B7 ');

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-left px-1',
        className,
      )}
      type="button"
    >
      <UserAvatar name={paidByName} size="sm" />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{description}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>

      <div className="text-right shrink-0">
        <p
          className={cn(
            'font-semibold',
            zero
              ? 'text-muted-foreground'
              : positive
                ? 'text-owed-to-you'
                : 'text-you-owe',
          )}
        >
          {zero ? formatMoney(netAmount) : `${positive ? '+' : ''}${formatMoney(netAmount)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatMoney(totalAmount)}
        </p>
      </div>
    </button>
  );
}
