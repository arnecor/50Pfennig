/**
 * features/activities/ActivityFeed.tsx
 *
 * Renders the sorted activity list on the home screen.
 * Each activity type (expense, settlement, group_membership) has its own row.
 * Pagination: a "Load more" button appears when more items are available.
 */

import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { negate, subtract } from '@domain/money';
import type { Money } from '@domain/types';
import { ArrowDownLeft, ArrowUpRight, Receipt, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ActivityItem } from './types';

type Props = {
  items: ActivityItem[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onItemClick?: (item: ActivityItem) => void;
};

function ActivitySkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-36 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-3.5 w-14 animate-pulse rounded bg-muted" />
    </div>
  );
}

type RowProps = {
  icon: React.ReactNode;
  iconBg: string;
  primary: string;
  secondary: string;
  amount?: Money;
  showSign?: boolean;
  colored?: boolean;
};

function ActivityRow({ icon, iconBg, primary, secondary, amount, showSign, colored }: RowProps) {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{primary}</p>
        <p className="truncate text-xs text-muted-foreground">{secondary}</p>
      </div>
      {amount !== undefined && (
        <MoneyDisplay
          amount={amount}
          {...(showSign && { showSign })}
          {...(colored && { colored })}
          className="shrink-0 text-sm font-semibold tabular-nums"
        />
      )}
    </div>
  );
}

export default function ActivityFeed({ items, isLoading, hasMore, onLoadMore, onItemClick }: Props) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const formatDate = (date: Date) =>
    date.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="divide-y rounded-xl border bg-card overflow-hidden">
        <ActivitySkeleton />
        <ActivitySkeleton />
        <ActivitySkeleton />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t('home.no_activity')}
      </p>
    );
  }

  return (
    <div className="space-y-0">
      <div className="divide-y rounded-xl border bg-card overflow-hidden">
        {items.map(item => {
          const isClickable = onItemClick && (item.type === 'expense' || item.type === 'settlement');
          const wrapperClass = isClickable
            ? 'cursor-pointer hover:bg-muted/50 transition-colors'
            : '';

          if (item.type === 'expense') {
            // Signed share: positive = I'm owed (I paid), negative = I owe (I didn't pay)
            const signedShare: Money = item.paidByCurrentUser
              ? subtract(item.totalAmount, item.myShare)
              : negate(item.myShare);

            const contextLabel = item.groupName
              ? item.groupName
              : t('friends.direct_expense');

            const secondary = `${item.paidByName} · ${contextLabel} · ${formatDate(item.date)}`;

            return (
              <div key={item.id} className={wrapperClass} onClick={isClickable ? () => onItemClick(item) : undefined} role={isClickable ? 'button' : undefined}>
                <ActivityRow
                  icon={<Receipt className="h-4 w-4 text-primary" />}
                  iconBg="bg-primary/10"
                  primary={item.description}
                  secondary={secondary}
                  amount={signedShare}
                  showSign
                  colored
                />
              </div>
            );
          }

          if (item.type === 'settlement') {
            const primary = item.isMePaying
              ? t('home.activity_you_paid_back', { name: item.otherPartyName })
              : t('home.activity_paid_back_to_you', { name: item.otherPartyName });

            const contextLabel = item.groupName ?? t('friends.direct_expense');
            const secondary = `${contextLabel} · ${formatDate(item.date)}`;

            const displayAmount: Money = item.isMePaying ? negate(item.amount) : item.amount;

            return (
              <div key={item.id} className={wrapperClass} onClick={isClickable ? () => onItemClick(item) : undefined} role={isClickable ? 'button' : undefined}>
                <ActivityRow
                  icon={
                    item.isMePaying
                      ? <ArrowUpRight className="h-4 w-4 text-red-600" />
                      : <ArrowDownLeft className="h-4 w-4 text-green-600" />
                  }
                  iconBg={item.isMePaying ? 'bg-red-50' : 'bg-green-50'}
                  primary={primary}
                  secondary={secondary}
                  amount={displayAmount}
                  showSign
                  colored
                />
              </div>
            );
          }

          // group_membership
          return (
            <ActivityRow
              key={item.id}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              iconBg="bg-muted"
              primary={t('home.activity_group_joined', { group: item.groupName })}
              secondary={formatDate(item.date)}
            />
          );
        })}
      </div>

      {hasMore && (
        <div className="pt-2 flex justify-center">
          <Button variant="ghost" size="sm" onClick={onLoadMore}>
            {t('home.load_more')}
          </Button>
        </div>
      )}
    </div>
  );
}
