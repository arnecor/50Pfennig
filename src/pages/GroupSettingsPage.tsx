/**
 * pages/GroupSettingsPage.tsx
 *
 * Route: /groups/:groupId/settings
 *
 * Shows:
 *   - Share section (link / QR placeholders, not yet implemented)
 *   - Member list with per-member balance
 *   - "Gruppe verlassen" button (disabled when user's balance ≠ 0)
 */

import { cn } from '@/lib/utils';
import { PageHeader } from '@components/shared/PageHeader';
import { Button } from '@components/ui/button';
import { calculateGroupBalances } from '@domain/balance';
import { formatMoney, isPositive, isZero } from '@domain/money';
import { type GroupId, type UserId, ZERO } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useFriends } from '@features/friends/hooks/useFriends';
import AddMemberOverlay from '@features/groups/components/AddMemberOverlay';
import { useAddGroupMembers } from '@features/groups/hooks/useAddGroupMembers';
import { useLeaveGroup } from '@features/groups/hooks/useLeaveGroup';
import { useGroup } from '@features/groups/hooks/useGroups';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Link2, LogOut, QrCode, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function GroupSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(
    groupId as GroupId,
  );
  const { data: friends = [] } = useFriends();

  const addMembers = useAddGroupMembers();
  const leaveGroup = useLeaveGroup();
  const [showMemberOverlay, setShowMemberOverlay] = useState(false);

  const isLoading = groupLoading || expensesLoading || settlementsLoading;

  const balanceMap = useMemo(() => {
    if (!group || !expenses) return new Map();
    return calculateGroupBalances(expenses, settlements, group.members);
  }, [expenses, settlements, group]);

  const myBalance = useMemo(() => {
    if (!currentUserId) return ZERO;
    return balanceMap.get(currentUserId) ?? ZERO;
  }, [balanceMap, currentUserId]);

  const canLeave = isZero(myBalance) && !isLoading;

  function handleBack() {
    navigate({ to: '/groups/$groupId', params: { groupId } });
  }

  function handleAddMembers(userIds: UserId[]) {
    if (!group) return;
    addMembers.mutate(
      { groupId: group.id, userIds },
      { onSuccess: () => setShowMemberOverlay(false) },
    );
  }

  function handleLeave() {
    if (!window.confirm(t('groups.leave_group_confirm'))) return;
    leaveGroup.mutate(groupId as GroupId, {
      onSuccess: () => navigate({ to: '/groups' }),
      onError: () => window.alert(t('common.error_generic')),
    });
  }

  return (
    <div className="min-h-full pb-24">
      <PageHeader
        title={groupLoading ? '…' : (group?.name ?? '')}
        subtitle={t('groups.settings')}
        onBack={handleBack}
      />

      <div className="px-5 space-y-5">
        {/* Share section */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {t('groups.share_group')}
          </p>
          <p className="text-xs text-muted-foreground mb-3">{t('groups.share_coming_soon')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
            >
              <Link2 className="h-4 w-4" />
              {t('groups.share_link')}
            </button>
            <button
              type="button"
              disabled
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
            >
              <QrCode className="h-4 w-4" />
              {t('groups.share_qr')}
            </button>
          </div>
        </div>

        {/* Members section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('groups.members')}
              {group ? ` (${group.members.length})` : ''}
            </p>
            <button
              type="button"
              onClick={() => setShowMemberOverlay(true)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t('groups.add_members')}
            </button>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden px-4">
            {isLoading && (
              <>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                  >
                    <div className="flex-1 h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </>
            )}

            {!isLoading &&
              group?.members.map((member) => {
                const balance = balanceMap.get(member.userId) ?? ZERO;
                const settled = isZero(balance);
                const positive = isPositive(balance);
                const isMe = (member.userId as string) === (currentUserId as string);

                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {isMe ? t('common.you') : member.displayName}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            ({member.displayName})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {settled ? (
                        <p className="text-sm text-muted-foreground">{t('groups.balanced')}</p>
                      ) : (
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            positive ? 'text-owed-to-you' : 'text-you-owe',
                          )}
                        >
                          {positive ? '+' : ''}
                          {formatMoney(balance)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Leave group section */}
        <div>
          {!canLeave && !isLoading && !isZero(myBalance) && (
            <p className="text-xs text-muted-foreground text-center mb-3 px-2">
              {t('groups.leave_blocked_hint')}
            </p>
          )}
          <Button
            variant="destructive"
            className="w-full"
            disabled={!canLeave || leaveGroup.isPending}
            onClick={handleLeave}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {leaveGroup.isPending ? t('common.loading') : t('groups.leave_group')}
          </Button>
        </div>
      </div>

      {showMemberOverlay && group && (
        <AddMemberOverlay
          group={group}
          friends={friends}
          onAddMembers={handleAddMembers}
          isPending={addMembers.isPending}
          onClose={() => setShowMemberOverlay(false)}
        />
      )}
    </div>
  );
}
