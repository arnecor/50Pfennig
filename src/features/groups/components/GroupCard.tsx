/**
 * features/groups/components/GroupCard.tsx
 *
 * Tappable card for a single group in the groups list.
 * Shows the group name, member count, and the user's net balance
 * in that group (derived from cached expenses + settlements).
 */

import { cn } from '@/lib/utils';
import PendingSyncMarker from '@components/PendingSyncMarker';
import { GroupAvatar } from '@components/shared/GroupAvatar';
import { Badge } from '@components/ui/badge';
import { calculateGroupBalances } from '@domain/balance';
import { formatMoney, isNegative, isZero } from '@domain/money';
import type { Group, UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useNavigate } from '@tanstack/react-router';
import { Archive, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  group: Group;
};

export default function GroupCard({ group }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const userId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;
  const { data: expenses } = useExpenses(group.id);
  const { data: settlements } = useSettlements(group.id);

  const balance = useMemo(() => {
    if (!expenses || !settlements || !userId) return undefined;
    const balances = calculateGroupBalances(expenses, settlements, group.members);
    return balances.get(userId);
  }, [expenses, settlements, userId, group.members]);

  const settled = balance !== undefined && isZero(balance);
  const positive = balance !== undefined && !isNegative(balance);
  const archived = group.isArchived;

  const memberNames = group.members.map((m) => m.displayName);
  function formatMemberNames(names: string[], max: number) {
    if (names.length <= max) return names.join(', ');
    return `${names.slice(0, max).join(', ')} +${names.length - max}`;
  }

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/groups/$groupId', params: { groupId: group.id } })}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left',
        archived || settled
          ? 'bg-muted/30 border-border/50 hover:bg-muted/40'
          : 'bg-card border-border hover:bg-muted/50',
      )}
    >
      {/* Group image / icon */}
      <GroupAvatar imageUrl={group.imageUrl} groupName={group.name} size="lg" />

      {/* Name + members */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-semibold truncate flex items-center gap-1.5',
            archived || settled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          <span className="truncate">{group.name}</span>
          <PendingSyncMarker id={String(group.id)} />
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {formatMemberNames(memberNames, 3)}
        </p>
      </div>

      {/* Balance — replaced by archive badge for archived groups */}
      {archived ? (
        <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
          <Archive className="w-3 h-3" />
          {t('groups.archived_badge')}
        </Badge>
      ) : (
        balance !== undefined && (
          <div className="text-right shrink-0">
            {settled ? (
              <p className="text-xs font-medium text-muted-foreground">{t('groups.balanced')}</p>
            ) : (
              <p className={cn('font-semibold', positive ? 'text-owed-to-you' : 'text-you-owe')}>
                {positive ? '+' : ''}
                {formatMoney(balance)}
              </p>
            )}
          </div>
        )
      )}

      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </button>
  );
}
