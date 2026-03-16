/**
 * pages/SettlementDetailPage.tsx
 *
 * Route: /settlements/:settlementId
 */

import MoneyDisplay from '@components/shared/MoneyDisplay';
import { PageHeader } from '@components/shared/PageHeader';
import type { SettlementId, UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useGroups } from '@features/groups/hooks/useGroups';
import { settlementByIdQueryOptions } from '@features/settlements/settlementQueries';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { ArrowDown } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function SettlementDetailPage() {
  const { t, i18n } = useTranslation();
  const { settlementId } = useParams({ strict: false }) as { settlementId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;

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
        const member = g.members.find((m) => (m.userId as string) === userId);
        if (member) return member.displayName;
      }
      const friend = friends.find((f) => (f.userId as string) === userId);
      if (friend) return friend.displayName;
      return userId;
    };
  }, [currentUserId, groups, friends, t]);

  const contextLabel = useMemo(() => {
    if (!settlement) return null;
    if (settlement.groupId) {
      const group = groups.find((g) => g.id === settlement.groupId);
      return group?.name ?? t('groups.title');
    }
    return t('friends.direct_expense');
  }, [settlement, groups, t]);

  if (isLoading) {
    return (
      <div className="min-h-full">
        <PageHeader
          title={t('payment_detail.settlement_title')}
          onBack={() => window.history.back()}
        />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="min-h-full">
        <PageHeader
          title={t('payment_detail.settlement_title')}
          onBack={() => window.history.back()}
        />
        <div className="flex items-center justify-center px-5 pt-20">
          <p className="text-muted-foreground">{t('common.error_generic')}</p>
        </div>
      </div>
    );
  }

  const fromName = resolveName(settlement.fromUserId as string);
  const toName = resolveName(settlement.toUserId as string);

  return (
    <div className="min-h-full pb-10">
      <PageHeader
        title={t('payment_detail.settlement_title')}
        onBack={() => window.history.back()}
      />

      <div className="px-5 pt-4 space-y-5">
        {/* Title + context */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t('payment_detail.settlement_label')}
          </h2>
          {contextLabel && (
            <span className="mt-2 inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {contextLabel}
            </span>
          )}
        </div>

        {/* Amount card */}
        <div className="rounded-2xl bg-card border border-border px-5 py-5 space-y-3">
          <MoneyDisplay amount={settlement.amount} className="text-3xl font-bold tabular-nums" />
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
          </p>
        </div>

        {/* Transaction */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t('payment_detail.transaction_section')}
          </h3>
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex flex-col items-start gap-1">
              <p className="text-sm font-semibold">{fromName}</p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowDown className="h-4 w-4" />
                <MoneyDisplay amount={settlement.amount} className="text-xs tabular-nums" />
              </div>
              <p className="text-sm font-semibold">{toName}</p>
            </div>
          </div>
        </div>

        {/* Note */}
        {settlement.note && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {t('payment_detail.note_section')}
            </h3>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-sm text-muted-foreground">{settlement.note}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
