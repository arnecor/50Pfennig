import EmptyState from '@components/shared/EmptyState';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { calculateGroupBalances, simplifyDebts } from '@domain/balance';
import type { GroupId, Settlement, UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useGroup } from '@features/groups/hooks/useGroups';
import RecordSettlementSheet from '@features/settlements/components/RecordSettlementSheet';
import { useDeleteSettlement } from '@features/settlements/hooks/useDeleteSettlement';
import { useRecordSettlement } from '@features/settlements/hooks/useRecordSettlement';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, HandCoins, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

function SettlementSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export default function SettlementsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(groupId as GroupId);

  const recordSettlement = useRecordSettlement();
  const deleteSettlement = useDeleteSettlement(groupId as GroupId);

  const [isRecordOpen, setIsRecordOpen] = useState(false);

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;
  const isLoading = groupLoading || expensesLoading || settlementsLoading;

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of group?.members ?? []) {
      map.set(member.userId as string, member.displayName);
    }
    return map;
  }, [group?.members]);

  const suggestedDebt = useMemo(() => {
    if (!group || !currentUserId) return undefined;
    const balances = calculateGroupBalances(expenses, settlements, group.members);
    const suggestions = simplifyDebts(balances);
    return suggestions.find((s) => s.fromUserId === currentUserId) ?? suggestions[0];
  }, [group, currentUserId, expenses, settlements]);

  const handleDelete = (settlement: Settlement) => {
    const ok = window.confirm(t('common.confirm'));
    if (!ok) return;
    deleteSettlement.mutate(settlement.id);
  };

  const handleCreate = (
    payload: { fromUserId: UserId; toUserId: UserId; amount: Settlement['amount']; note?: string },
  ) => {
    recordSettlement.mutate(
      {
        groupId: groupId as GroupId,
        ...payload,
      },
      { onSuccess: () => setIsRecordOpen(false) },
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/groups/$groupId', params: { groupId } })} aria-label={t('common.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{t('settlements.title')}</h1>
          {group && (
            <p className="text-xs text-muted-foreground truncate">{group.name}</p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        {isLoading && (
          <div className="space-y-3">
            <SettlementSkeleton />
            <SettlementSkeleton />
            <SettlementSkeleton />
          </div>
        )}

        {!isLoading && settlements.length === 0 && (
          <EmptyState
            icon={<HandCoins className="h-12 w-12" />}
            title={t('settlements.empty_title')}
            action={
              <Button onClick={() => setIsRecordOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('settlements.record')}
              </Button>
            }
          />
        )}

        {!isLoading && settlements.length > 0 && (
          <div className="space-y-3">
            {settlements.map((settlement) => {
              const fromName = nameByUserId.get(settlement.fromUserId as string) ?? settlement.fromUserId;
              const toName = nameByUserId.get(settlement.toUserId as string) ?? settlement.toUserId;
              const canDelete = currentUserId && settlement.fromUserId === currentUserId;

              return (
                <Card key={settlement.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {fromName} → {toName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {settlement.createdAt.toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                        {settlement.note && (
                          <p className="mt-1 text-xs text-muted-foreground">{settlement.note}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <MoneyDisplay amount={settlement.amount} className="text-sm font-semibold tabular-nums" colored={false} />
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('common.delete')}
                            onClick={() => handleDelete(settlement)}
                            disabled={deleteSettlement.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="fixed left-0 right-0 z-10 flex justify-center px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem + 0.75rem)' }}
      >
        <Button size="lg" onClick={() => setIsRecordOpen(true)} className="gap-2 rounded-full px-6 shadow-lg">
          <Plus className="h-5 w-5" />
          {t('settlements.record')}
        </Button>
      </div>

      {isRecordOpen && group && (
        <RecordSettlementSheet
          group={group}
          defaultDebt={suggestedDebt}
          isPending={recordSettlement.isPending}
          onClose={() => setIsRecordOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
