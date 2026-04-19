/**
 * pages/SettlementsPage.tsx
 *
 * Route: /groups/:groupId/settlements
 */

import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { PageHeader } from '@components/shared/PageHeader';
import { Button } from '@components/ui/button';
import { calculateGroupBalances, simplifyDebts } from '@domain/balance';
import { formatMoney } from '@domain/money';
import type { DebtInstruction, GroupId, UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useGroup } from '@features/groups/hooks/useGroups';
import RecordGroupSettlementSheet from '@features/settlements/components/RecordGroupSettlementSheet';
import { useDeleteSettlement } from '@features/settlements/hooks/useDeleteSettlement';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeftRight, Plus, Trash2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function SettlementsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(
    groupId as GroupId,
  );

  const deleteSettlement = useDeleteSettlement();

  const [showSheet, setShowSheet] = useState(false);
  const [suggestion, setSuggestion] = useState<DebtInstruction | undefined>();

  const isLoading = groupLoading || expensesLoading || settlementsLoading;
  const dateLocale = i18n.language === 'de' ? 'de-DE' : 'en-GB';

  const suggestions = useMemo((): DebtInstruction[] => {
    if (!group) return [];
    return simplifyDebts(calculateGroupBalances(expenses, settlements, group.members));
  }, [group, expenses, settlements]);

  const memberName = (id: UserId) => {
    if ((id as string) === (currentUserId as string)) return t('common.you');
    const member = group?.members.find((m) => (m.userId as string) === (id as string));
    if (!member) return String(id);
    return member.isDeleted ? t('common.deleted_user') : member.displayName;
  };

  const handleOpenSheet = (s?: DebtInstruction) => {
    setSuggestion(s);
    setShowSheet(true);
  };
  const handleCloseSheet = () => {
    setShowSheet(false);
    setSuggestion(undefined);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t('settlements.delete_confirm'))) return;
    const record = settlements.find((s) => (s.id as string) === id);
    if (!record) return;
    const records = record.batchId
      ? settlements.filter((s) => s.batchId === record.batchId)
      : [record];
    deleteSettlement.mutate(records);
  };

  return (
    <div className="min-h-full pb-10">
      <PageHeader
        title={groupLoading ? '…' : t('settlements.title')}
        onBack={() => navigate({ to: '/groups/$groupId', params: { groupId } })}
        onAction={() => handleOpenSheet(undefined)}
        actionIcon={<Plus className="w-5 h-5" />}
        actionLabel={t('settlements.record')}
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

        {!isLoading && (
          <>
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <section className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('settlements.suggested_title')}
                </p>
                <div className="space-y-3">
                  {suggestions.map((s) => (
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
                        {t('settlements.settle_now')}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* History */}
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('settlements.history_title')}
              </p>

              {settlements.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="h-12 w-12" />}
                  title={t('settlements.empty_title')}
                  description={t('settlements.empty_description')}
                  action={
                    group ? (
                      <button
                        type="button"
                        onClick={() => handleOpenSheet(undefined)}
                        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        {t('settlements.record')}
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="bg-card rounded-2xl border border-border overflow-hidden px-4">
                  {settlements.map((s) => (
                    <div
                      key={String(s.id)}
                      className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {memberName(s.fromUserId)} → {memberName(s.toUserId)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.note && <>{s.note} · </>}
                          {s.createdAt.toLocaleDateString(dateLocale, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <MoneyDisplay
                        amount={s.amount}
                        className="shrink-0 text-sm font-semibold tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => handleDelete(String(s.id))}
                        disabled={deleteSettlement.isPending}
                        aria-label={t('settlements.delete_aria')}
                        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {showSheet && group && currentUserId && (
        <RecordGroupSettlementSheet
          group={group}
          currentUserId={currentUserId}
          {...(suggestion !== undefined && { suggestion })}
          onClose={handleCloseSheet}
        />
      )}
    </div>
  );
}
