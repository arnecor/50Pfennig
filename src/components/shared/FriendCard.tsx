import { cn } from '@/lib/utils';
import { UserAvatar } from '@components/shared/UserAvatar';
import { formatMoney, isNegative, isZero } from '@domain/money';
import type { Money } from '@domain/types';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type FriendCardProps = {
  name: string;
  /** Positive = they owe you, negative = you owe them. */
  balance: Money;
  /** Label shown below the name when not settled (e.g. "Owes you" / "You owe"). */
  balanceLabel?: string;
  /** Label shown when balance is zero (e.g. "Ausgeglichen"). */
  settledLabel?: string;
  onClick?: () => void;
  className?: string;
};

export function FriendCard({
  name,
  balance,
  balanceLabel,
  settledLabel,
  onClick,
  className,
}: FriendCardProps) {
  const { t } = useTranslation();
  const positive = !isNegative(balance);
  const settled = isZero(balance);
  const resolvedSettledLabel = settledLabel ?? t('friends.balanced');

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
        settled
          ? 'bg-muted/30 border-border/50 hover:bg-muted/40'
          : 'bg-card border-border hover:bg-muted/50',
        className,
      )}
      type="button"
    >
      <UserAvatar name={name} size="md" />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-semibold truncate',
            settled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {name}
        </p>
        {!settled && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {balanceLabel ?? (positive ? t('friends.owes_you') : t('friends.you_owe'))}
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        {settled ? (
          <p className="text-xs font-medium text-muted-foreground">{resolvedSettledLabel}</p>
        ) : (
          <p className={cn('font-bold text-base', positive ? 'text-owed-to-you' : 'text-you-owe')}>
            {positive ? '+' : ''}
            {formatMoney(balance)}
          </p>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

type FriendListItemProps = {
  name: string;
  balance: Money;
  settledLabel?: string;
  onClick?: () => void;
  showCheckbox?: boolean;
  isSelected?: boolean;
  className?: string;
};

export function FriendListItem({
  name,
  balance,
  settledLabel,
  onClick,
  showCheckbox = false,
  isSelected = false,
  className,
}: FriendListItemProps) {
  const { t } = useTranslation();
  const positive = !isNegative(balance);
  const settled = isZero(balance);
  const resolvedSettledLabel = settledLabel ?? t('friends.balanced');

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-left px-1',
        className,
      )}
      type="button"
    >
      {showCheckbox && (
        <div
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground',
          )}
        >
          {isSelected && (
            <svg
              className="w-3 h-3 text-primary-foreground"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      )}

      <UserAvatar name={name} size="md" />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{name}</p>
      </div>

      {!showCheckbox && (
        <>
          <p
            className={cn(
              'font-semibold shrink-0',
              settled ? 'text-muted-foreground' : positive ? 'text-owed-to-you' : 'text-you-owe',
            )}
          >
            {settled ? resolvedSettledLabel : `${positive ? '+' : ''}${formatMoney(balance)}`}
          </p>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </>
      )}
    </button>
  );
}
