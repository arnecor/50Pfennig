/**
 * pages/SettlementDetailPage.tsx
 *
 * Route: /settlements/:settlementId
 *
 * Shows all details of a single settlement (payment):
 *   - Context (group or direct)
 *   - Amount, exact date/time
 *   - Sender → receiver transaction
 *   - Optional note
 */

import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { type SettlementId, type UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useGroups } from '@features/groups/hooks/useGroups';
import { settlementByIdQueryOptions } from '@features/settlements/settlementQueries';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowDown, ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function SettlementDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settlementId } = useParams({ strict: false }) as { settlementId: string };

  const currentUserId = useAuthStore(s => s.session?.user.id) as UserId | undefined;

  const { data: settlement, isLoading } = useQuery(
    settlementByIdQueryOptions(settlementId as SettlementId),
  );

  const { data: groups = [] } = useGroups();
  const { data: friends = [] } = useFriends();

  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const resolveName = useMemo(() => {
    return (userId: string): string => {
      if (currentUserId && userId === (currentUserId as string)) return t('common.you');
      for (const g of groups) {
        const member = g.members.find(m => (m.userId as string) === userId);
        if (member) return member.displayName;
      }
      const friend = friends.find(f => (f.userId as string) === userId);
      if (friend) return friend.displayName;
      return userId;
    };
  }, [currentUserId, groups, friends, t]);

  const contextLabel = useMemo(() => {
    if (!settlement) return null;
    if (settlement.groupId) {
      const group = groups.find(g => g.id === settlement.groupId);
      return group?.name ?? t('groups.title');
    }
    return t('friends.direct_expense');
  }, [settlement, groups, t]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="flex items-center gap-3 border-b px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: -1 as never })} aria-label={t('common.back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{t('payment_detail.settlement_title')}</h1>
        </header>
        <div className="flex-1 px-4 py-6 space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="flex items-center gap-3 border-b px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: -1 as never })} aria-label={t('common.back')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{t('payment_detail.settlement_title')}</h1>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-muted-foreground">{t('common.error_generic')}</p>
        </div>
      </div>
    );
  }

  const fromName = resolveName(settlement.fromUserId as string);
  const toName   = resolveName(settlement.toUserId as string);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: -1 as never })} aria-label={t('common.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('payment_detail.settlement_title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Title + context */}
        <div>
          <h2 className="text-xl font-bold">{t('payment_detail.settlement_label')}</h2>
          {contextLabel && (
            <span className="mt-1 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {contextLabel}
            </span>
          )}
        </div>

        {/* Amount block */}
        <div className="rounded-lg bg-muted/50 px-4 py-4 space-y-2">
          <MoneyDisplay
            amount={settlement.amount}
            className="text-3xl font-bold tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            {settlement.createdAt.toLocaleDateString(dateLocale, {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
            {', '}
            {settlement.createdAt.toLocaleTimeString(dateLocale, {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' '}
            {t('payment_detail.time_suffix')}
          </p>
        </div>

        {/* Transaction */}
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('payment_detail.transaction_section')}</h3>
          <div className="rounded-lg border px-4 py-3">
            <div className="flex flex-col items-start gap-1">
              <p className="text-sm font-medium">{fromName}</p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowDown className="h-4 w-4" />
                <MoneyDisplay
                  amount={settlement.amount}
                  className="text-xs tabular-nums"
                />
              </div>
              <p className="text-sm font-medium">{toName}</p>
            </div>
          </div>
        </div>

        {/* Note */}
        {settlement.note && (
          <div>
            <h3 className="text-sm font-semibold mb-2">{t('payment_detail.note_section')}</h3>
            <div className="rounded-lg border px-4 py-3">
              <p className="text-sm text-muted-foreground">{settlement.note}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
