/**
 * features/groups/components/GroupCard.tsx
 *
 * Tappable card for a single group in the groups list.
 * Shows the group name, member count, and the user's net balance
 * in that group (derived from cached expenses + settlements).
 *
 * Balance is derived in the background — the card renders immediately
 * and the figure appears once both queries resolve.
 */

import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@components/ui/card';
import MoneyDisplay from '@components/shared/MoneyDisplay';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useAuthStore } from '@features/auth/authStore';
import { calculateGroupBalances } from '@domain/balance';
import type { Group, UserId } from '@domain/types';

type Props = {
  group: Group;
};

export default function GroupCard({ group }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const userId = useAuthStore(s => s.session?.user.id) as UserId | undefined;
  const { data: expenses }    = useExpenses(group.id);
  const { data: settlements } = useSettlements(group.id);

  const balance = useMemo(() => {
    if (!expenses || !settlements || !userId) return undefined;
    const balances = calculateGroupBalances(expenses, settlements, group.members);
    return balances.get(userId);
  }, [expenses, settlements, userId, group.members]);

  return (
    <Card
      className="cursor-pointer transition-transform active:scale-[0.98]"
      onClick={() =>
        navigate({ to: '/groups/$groupId', params: { groupId: group.id } })
      }
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{group.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {group.members.length} {t('groups.members')}
            </p>
          </div>

          {balance !== undefined && (
            <MoneyDisplay
              amount={balance}
              showSign
              colored
              className="shrink-0 text-sm font-medium"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
