import { cn } from '@/lib/utils';
import { GroupAvatar } from '@components/shared/GroupAvatar';
import { formatMoney, isNegative, isZero } from '@domain/money';
import type { Money } from '@domain/types';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function formatMemberNames(names: string[], maxVisible = 3): string {
  if (names.length === 0) return '';
  const visible = names.slice(0, maxVisible);
  const remaining = names.length - maxVisible;
  const joined = visible.join(', ');
  return remaining > 0 ? `${joined} +${remaining}` : joined;
}

type GroupCardProps = {
  name: string;
  memberNames: string[];
  /** Positive = owed to you, negative = you owe. */
  balance: Money;
  /** Label shown when balance is zero (e.g. "Ausgeglichen"). */
  settledLabel?: string;
  /** Predefined icon key (legacy). imageUrl takes precedence when provided. */
  icon?: string;
  /** Custom image URL or 'icon:X' predefined value from the group domain. */
  imageUrl?: string;
  onClick?: () => void;
  className?: string;
};

export function GroupCard({
  name,
  memberNames,
  balance,
  settledLabel,
  icon,
  imageUrl,
  onClick,
  className,
}: GroupCardProps) {
  const { t } = useTranslation();
  const positive = !isNegative(balance);
  const settled = isZero(balance);
  const resolvedSettledLabel = settledLabel ?? t('groups.balanced');
  // Resolve display image: prefer explicit imageUrl, fall back to legacy icon key
  const resolvedImageUrl = imageUrl ?? (icon && icon !== 'default' ? `icon:${icon}` : undefined);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left',
        settled
          ? 'bg-muted/30 border-border/50 hover:bg-muted/40'
          : 'bg-card border-border hover:bg-muted/50',
        className,
      )}
      type="button"
    >
      <GroupAvatar imageUrl={resolvedImageUrl} groupName={name} size="lg" />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-semibold truncate',
            settled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {formatMemberNames(memberNames, 3)}
        </p>
      </div>

      <div className="text-right shrink-0">
        {settled ? (
          <p className="text-xs font-medium text-muted-foreground">{resolvedSettledLabel}</p>
        ) : (
          <p className={cn('font-semibold', positive ? 'text-owed-to-you' : 'text-you-owe')}>
            {positive ? '+' : ''}
            {formatMoney(balance)}
          </p>
        )}
      </div>

      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </button>
  );
}

type GroupListItemProps = {
  name: string;
  memberNames: string[];
  balance: Money;
  settledLabel?: string;
  /** Predefined icon key (legacy). imageUrl takes precedence when provided. */
  icon?: string;
  /** Custom image URL or 'icon:X' predefined value from the group domain. */
  imageUrl?: string;
  onClick?: () => void;
  className?: string;
};

export function GroupListItem({
  name,
  memberNames,
  balance,
  settledLabel,
  icon,
  imageUrl,
  onClick,
  className,
}: GroupListItemProps) {
  const { t } = useTranslation();
  const positive = !isNegative(balance);
  const settled = isZero(balance);
  const resolvedSettledLabel = settledLabel ?? t('groups.balanced');
  const resolvedImageUrl = imageUrl ?? (icon && icon !== 'default' ? `icon:${icon}` : undefined);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 py-3 border-b transition-colors text-left px-1',
        settled ? 'border-border/40 hover:bg-muted/20' : 'border-border hover:bg-muted/30',
        className,
      )}
      type="button"
    >
      <GroupAvatar imageUrl={resolvedImageUrl} groupName={name} size="md" />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-medium truncate',
            settled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {formatMemberNames(memberNames, 3)}
        </p>
      </div>

      {settled ? (
        <p className="text-xs font-medium text-muted-foreground">{resolvedSettledLabel}</p>
      ) : (
        <p className={cn('font-semibold shrink-0', positive ? 'text-owed-to-you' : 'text-you-owe')}>
          {positive ? '+' : ''}
          {formatMoney(balance)}
        </p>
      )}

      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </button>
  );
}
