/**
 * pages/BalancesPage.tsx
 *
 * Route: /groups/:groupId/balances
 *
 * Shows simplified "who pays whom" debt instructions for a group.
 * No history, no delete — focused on the current balance state.
 */

import EmptyState from '@components/shared/EmptyState';
import { PageHeader } from '@components/shared/PageHeader';
import { Button } from '@components/ui/button';
import { formatMoney } from '@domain/money';
import type { DebtInstruction, GroupId, UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import GreedyExplainerSheet from '@features/balances/components/GreedyExplainerSheet';
import { useGroupBalances } from '@features/balances/hooks/useGroupBalances';
import RecordGroupSettlementSheet from '@features/settlements/components/RecordGroupSettlementSheet';
import { useNavigate, useParams } from '@tanstack/react-router';
import { CheckCircle, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function BalancesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;

  const { instructions, isLoading, group } = useGroupBalances(groupId as GroupId);

  const [showSheet, setShowSheet] = useState(false);
  const [suggestion, setSuggestion] = useState<DebtInstruction | undefined>();
  const [showExplainer, setShowExplainer] = useState(false);

  const memberName = (id: UserId) => {
    if ((id as string) === (currentUserId as string)) return t('common.you');
    return (
      group?.members.find((m) => (m.userId as string) === (id as string))?.displayName ?? String(id)
    );
  };

  const handleOpenSheet = (s: DebtInstruction) => {
    setSuggestion(s);
    setShowSheet(true);
  };

  const handleCloseSheet = () => {
    setShowSheet(false);
    setSuggestion(undefined);
  };

  return (
    <div className="min-h-full pb-10">
      <PageHeader
        title={t('balances.page_title')}
        onBack={() => navigate({ to: '/groups/$groupId', params: { groupId } })}
      />

      <div className="px-5">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && instructions.length === 0 && (
          <EmptyState
            icon={<CheckCircle className="h-12 w-12" />}
            title={t('balances.settled_title')}
            description={t('balances.settled_description')}
          />
        )}

        {!isLoading && instructions.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('balances.suggestion_heading')}
              </p>
              <button
                type="button"
                onClick={() => setShowExplainer(true)}
                className="text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                aria-label={t('balances.explainer_open_label')}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {instructions.map((s) => (
                <div
                  key={`${String(s.fromUserId)}-${String(s.toUserId)}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {memberName(s.fromUserId)} → {memberName(s.toUserId)}
                    </p>
                    <p className="text-sm font-semibold text-you-owe tabular-nums">
                      {formatMoney(s.amount)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleOpenSheet(s)}
                  >
                    {t('balances.settle')}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {showExplainer && <GreedyExplainerSheet onClose={() => setShowExplainer(false)} />}

      {showSheet && group && currentUserId && (
        <RecordGroupSettlementSheet
          group={group}
          currentUserId={currentUserId}
          {...(suggestion !== undefined ? { suggestion } : {})}
          onClose={handleCloseSheet}
        />
      )}
    </div>
  );
}
