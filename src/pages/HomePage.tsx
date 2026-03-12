/**
 * pages/HomePage.tsx
 *
 * Route: /home
 *
 * Landing screen for authenticated users. Shows:
 *   1. Personal greeting
 *   2. Cross-group + cross-friend balance summary
 *   3. Recent activity feed (paginated, newest first)
 *   4. Floating action button (FAB) to add a new expense
 */

import MoneyDisplay from '@/components/shared/MoneyDisplay';
import { Card, CardContent } from '@/components/ui/card';
import { isNegative, isPositive } from '@/domain/money';
import type { UserId } from '@/domain/types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTotalBalance } from '@/features/balances/hooks/useTotalBalance';
import ActivityFeed from '@/features/activities/ActivityFeed';
import { useRecentActivity } from '@/features/activities/useRecentActivity';
import type { ActivityItem } from '@/features/activities/types';
import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName: string = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
  const currentUserId = user?.id as UserId | undefined;
  const { youAreOwed, youOwe, netTotal, isLoading } = useTotalBalance(currentUserId);

  const { items, isLoading: activityLoading, hasMore, loadMore } = useRecentActivity(
    currentUserId,
    t('common.you'),
  );

  const handleActivityClick = (item: ActivityItem) => {
    if (item.type === 'expense') {
      navigate({ to: '/expenses/$expenseId', params: { expenseId: String(item.id) } });
    } else if (item.type === 'settlement') {
      navigate({ to: '/settlements/$settlementId', params: { settlementId: String(item.id) } });
    }
  };

  const netColorClass = isPositive(netTotal)
    ? 'text-green-600'
    : isNegative(netTotal)
      ? 'text-destructive'
      : 'text-foreground';

  return (
    <div className="flex flex-col min-h-full">
      {/* Scrollable content — extra bottom padding so FAB doesn't cover last item */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 space-y-6">
        {/* Greeting */}
        <h1 className="text-2xl font-bold">{t('home.greeting', { name: displayName })}</h1>

        {/* Balance summary card */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('home.you_are_owed')}</span>
              {isLoading ? (
                <span className="text-muted-foreground">…</span>
              ) : (
                <MoneyDisplay amount={youAreOwed} colored className="font-medium" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('home.you_owe')}</span>
              {isLoading ? (
                <span className="text-muted-foreground">…</span>
              ) : (
                <MoneyDisplay amount={youOwe} colored className="font-medium" />
              )}
            </div>

            <div className="border-t" />

            <div className="flex items-center justify-between">
              <span className="font-semibold">{t('home.total')}</span>
              {isLoading ? (
                <span className="text-muted-foreground">…</span>
              ) : (
                <span className={`text-lg font-bold ${netColorClass}`}>
                  <MoneyDisplay amount={netTotal} />
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{t('home.recent_activity')}</h2>
          <ActivityFeed
            items={items}
            isLoading={activityLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onItemClick={handleActivityClick}
          />
        </div>
      </div>

      {/* Floating action button — fixed above the bottom nav */}
      <div
        className="fixed left-0 right-0 z-10 flex justify-center px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem + 0.75rem)' }}
      >
        <Button
          size="lg"
          onClick={() => navigate({ to: '/expenses/new', search: { groupId: undefined } })}
          className="gap-2 rounded-full px-6 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          {t('home.add_expense')}
        </Button>
      </div>
    </div>
  );
}
