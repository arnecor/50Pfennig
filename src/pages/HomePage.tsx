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

import { GreetingHeader, SectionHeader } from '@components/shared/PageHeader';
import { BalanceCard } from '@components/shared/BalanceCard';
import { FloatingActionButton } from '@components/shared/FloatingActionButton';
import type { UserId } from '@/domain/types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTotalBalance } from '@/features/balances/hooks/useTotalBalance';
import ActivityFeed from '@/features/activities/ActivityFeed';
import { useRecentActivity } from '@/features/activities/useRecentActivity';
import type { ActivityItem } from '@/features/activities/types';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName: string = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
  const currentUserId = user?.id as UserId | undefined;
  const { youAreOwed, youOwe } = useTotalBalance(currentUserId);

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

  return (
    <div className="min-h-full pb-24">
      <GreetingHeader name={displayName} />

      {/* Balance summary */}
      <div className="px-5">
        <BalanceCard youAreOwed={youAreOwed} youOwe={youOwe} />
      </div>

      {/* Recent activity */}
      <SectionHeader title={t('home.recent_activity')} />

      <div className="px-5">
        <ActivityFeed
          items={items}
          isLoading={activityLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onItemClick={handleActivityClick}
        />
      </div>

      <FloatingActionButton
        onClick={() => navigate({ to: '/expenses/new', search: { groupId: undefined } })}
        label={t('home.add_expense')}
      />
    </div>
  );
}
