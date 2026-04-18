/**
 * features/activities/ActivityFeed.tsx
 *
 * Renders the sorted activity list on the home screen.
 * Each activity type (expense, settlement, group_membership) has its own row.
 * Items are grouped by date with section headers.
 * Pagination: a "Load more" button appears when more items are available.
 */

import { GroupAvatar } from '@components/shared/GroupAvatar';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { UnifiedExpenseItem } from '@components/shared/UnifiedExpenseItem';
import { Button } from '@components/ui/button';
import { negate, subtract } from '@domain/money';
import type { Money } from '@domain/types';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
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
    <div className="flex items-center gap-3 py-3 px-1">
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
    <div className="flex items-center gap-3 py-3 px-1 border-b border-border last:border-0">
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function groupByDate(
  items: ActivityItem[],
  t: (key: string) => string,
  locale: string,
): { label: string; items: ActivityItem[] }[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const groups: { label: string; items: ActivityItem[] }[] = [];
  let currentLabel = '';

  for (const item of items) {
    let label: string;
    if (isSameDay(item.date, now)) {
      label = t('common.today');
    } else if (isSameDay(item.date, yesterday)) {
      label = t('common.yesterday');
    } else {
      label = item.date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
    }

    if (label !== currentLabel) {
      groups.push({ label, items: [item] });
      currentLabel = label;
    } else {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup) lastGroup.items.push(item);
    }
  }

  return groups;
}

export default function ActivityFeed({
  items,
  isLoading,
  hasMore,
  onLoadMore,
  onItemClick,
}: Props) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border overflow-hidden px-4">
        <ActivitySkeleton />
        <ActivitySkeleton />
        <ActivitySkeleton />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t('home.no_activity')}</p>
    );
  }

  const dateGroups = groupByDate(items, t, dateLocale);

  return (
    <div className="space-y-0">
      {dateGroups.map((group, groupIdx) => (
        <div key={group.label}>
          <p
            className={`px-1 pb-1 text-xs font-medium text-muted-foreground ${groupIdx === 0 ? '' : 'pt-4'}`}
          >
            {group.label}
          </p>
          <div className="rounded-2xl border border-border overflow-hidden px-4">
            {group.items.map((item) => {
              if (item.type === 'expense') {
                const signedShare = item.paidByCurrentUser
                  ? subtract(item.totalAmount, item.myShare)
                  : negate(item.myShare);

                return (
                  <UnifiedExpenseItem
                    key={item.id}
                    description={item.description}
                    paidByName={item.paidByName}
                    paidByAvatarUrl={item.paidByAvatarUrl}
                    totalAmount={item.totalAmount}
                    shareAmount={signedShare}
                    paidByCurrentUser={item.paidByCurrentUser}
                    expenseId={item.id}
                    {...(item.groupName !== undefined && { groupName: item.groupName })}
                    {...(onItemClick && { onClick: () => onItemClick(item) })}
                  />
                );
              }

              if (item.type === 'settlement') {
                const primary = item.isMePaying
                  ? t('home.activity_you_paid_back', { name: item.otherPartyName })
                  : t('home.activity_paid_back_to_you', { name: item.otherPartyName });

                const secondary = item.groupName ?? t('friends.direct_expense');
                const displayAmount: Money = item.isMePaying ? negate(item.amount) : item.amount;

                const settlementIcon = item.groupName ? (
                  <GroupAvatar
                    imageUrl={item.groupImageUrl}
                    groupName={item.groupName}
                    size="sm"
                    className="rounded-full"
                  />
                ) : item.isMePaying ? (
                  <ArrowUpRight className="h-4 w-4 text-red-600" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                );

                return (
                  <div
                    key={item.id}
                    className={
                      onItemClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''
                    }
                    onClick={onItemClick ? () => onItemClick(item) : undefined}
                    onKeyDown={
                      onItemClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') onItemClick(item);
                          }
                        : undefined
                    }
                    role={onItemClick ? 'button' : undefined}
                    tabIndex={onItemClick ? 0 : undefined}
                  >
                    <ActivityRow
                      icon={settlementIcon}
                      iconBg={item.groupName ? '' : item.isMePaying ? 'bg-red-50' : 'bg-green-50'}
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
                  icon={
                    <GroupAvatar
                      imageUrl={item.groupImageUrl}
                      groupName={item.groupName}
                      size="sm"
                      className="rounded-full"
                    />
                  }
                  iconBg=""
                  primary={t('home.activity_group_joined', { group: item.groupName })}
                  secondary=""
                />
              );
            })}
          </div>
        </div>
      ))}

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
