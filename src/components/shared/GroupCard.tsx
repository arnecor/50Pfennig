import {
  ChevronRight,
  Home,
  Plane,
  Trophy,
  Flame,
  Sparkles,
  BookOpen,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatMoney, isNegative, isZero } from '@domain/money';
import type { Money } from '@domain/types';
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  plane: Plane,
  trophy: Trophy,
  flame: Flame,
  sparkles: Sparkles,
  book: BookOpen,
  default: Users,
};

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
  icon?: string;
  onClick?: () => void;
  className?: string;
};

export function GroupCard({
  name,
  memberNames,
  balance,
  settledLabel,
  icon,
  onClick,
  className,
}: GroupCardProps) {
  const { t } = useTranslation();
  const Icon = iconMap[icon ?? 'default'] ?? iconMap.default!;
  const positive = !isNegative(balance);
  const settled = isZero(balance);
  const resolvedSettledLabel = settledLabel ?? t('groups.balanced');

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
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-foreground" />
      </div>

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
          <p className="text-xs font-medium text-muted-foreground">
            {resolvedSettledLabel}
          </p>
        ) : (
          <p
            className={cn(
              'font-semibold',
              positive ? 'text-owed-to-you' : 'text-you-owe',
            )}
          >
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
  icon?: string;
  onClick?: () => void;
  className?: string;
};

export function GroupListItem({
  name,
  memberNames,
  balance,
  settledLabel,
  icon,
  onClick,
  className,
}: GroupListItemProps) {
  const { t } = useTranslation();
  const Icon = iconMap[icon ?? 'default'] ?? iconMap.default!;
  const positive = !isNegative(balance);
  const settled = isZero(balance);
  const resolvedSettledLabel = settledLabel ?? t('groups.balanced');

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 py-3 border-b transition-colors text-left px-1',
        settled
          ? 'border-border/40 hover:bg-muted/20'
          : 'border-border hover:bg-muted/30',
        className,
      )}
      type="button"
    >
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-foreground" />
      </div>

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
        <p
          className={cn(
            'font-semibold shrink-0',
            positive ? 'text-owed-to-you' : 'text-you-owe',
          )}
        >
          {positive ? '+' : ''}
          {formatMoney(balance)}
        </p>
      )}

      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </button>
  );
}
