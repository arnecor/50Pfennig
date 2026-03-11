/**
 * pages/SettlementsPage.tsx
 *
 * Route: /groups/:groupId/settlements
 *
 * Two sections:
 *   1. Vorschläge — simplifyDebts() results. Each row has a "Jetzt begleichen"
 *      button that opens RecordGroupSettlementSheet with the suggestion pre-filled.
 *   2. Verlauf — all settlement records for this group, newest first.
 *      Delete action removes the full batch (if batchId is set).
 */

import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { calculateGroupBalances, simplifyDebts } from '@domain/balance';
import type { DebtInstruction, GroupId, UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useGroup } from '@features/groups/hooks/useGroups';
import RecordGroupSettlementSheet from '@features/settlements/components/RecordGroupSettlementSheet';
import { useDeleteSettlement } from '@features/settlements/hooks/useDeleteSettlement';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowLeftRight, Plus, Trash2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function SettlementsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const currentUserId = useAuthStore(s => s.session?.user.id) as UserId | undefined;

  const { data: group, isLoading: groupLoading }         = useGroup(groupId as GroupId);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(groupId as GroupId);

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
    return group?.members.find(m => (m.userId as string) === (id as string))?.displayName ?? String(id);
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
    // Pass as single-record array (all non-batch settlements are single-element)
    const record = settlements.find(s => (s.id as string) === id);
    if (!record) return;
    // Collect all records in this batch (for correct cache invalidation)
    const records = record.batchId
      ? settlements.filter(s => s.batchId === record.batchId)
      : [record];
    deleteSettlement.mutate(records);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/groups/$groupId', params: { groupId } })}
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 min-w-0 truncate text-lg font-semibold">
          {groupLoading ? '…' : t('settlements.title')}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 shrink-0"
          disabled={isLoading || !group}
          onClick={() => handleOpenSheet(undefined)}
        >
          <Plus className="h-4 w-4" />
          {t('settlements.record')}
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-lg border bg-card p-4">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <>
            {/* Suggestions — only shown when outstanding debts exist */}
            {suggestions.length > 0 && (
              <section className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('settlements.suggested_title')}
                </p>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <Card key={`${String(s.fromUserId)}-${String(s.toUserId)}`}>
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {memberName(s.fromUserId)}
                            {' → '}
                            {memberName(s.toUserId)}
                          </p>
                          <MoneyDisplay
                            amount={s.amount}
                            className="text-sm text-muted-foreground tabular-nums"
                          />
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleOpenSheet(s)}
                        >
                          {t('settlements.settle_now')}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* History */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('settlements.history_title')}
              </p>

              {settlements.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="h-12 w-12" />}
                  title={t('settlements.empty_title')}
                  description={t('settlements.empty_description')}
                  action={
                    group ? (
                      <Button className="gap-2" onClick={() => handleOpenSheet(undefined)}>
                        <Plus className="h-4 w-4" />
                        {t('settlements.record')}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-2">
                  {settlements.map(s => (
                    <Card key={String(s.id)}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {memberName(s.fromUserId)}
                            {' → '}
                            {memberName(s.toUserId)}
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
                        <div className="shrink-0 text-right">
                          <MoneyDisplay
                            amount={s.amount}
                            className="text-sm font-semibold tabular-nums"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(String(s.id))}
                          disabled={deleteSettlement.isPending}
                          aria-label={t('settlements.delete_aria')}
                          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Sheet overlay */}
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
