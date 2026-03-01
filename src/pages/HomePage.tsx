/**
 * pages/HomePage.tsx
 *
 * Route: /home
 *
 * Landing screen for authenticated users. Shows a personal greeting and a
 * cross-group balance summary (total owed to the user, total user owes, net).
 * Also provides a CTA to add a new expense (placeholder — wiring is a separate story).
 */

import MoneyDisplay from '@/components/shared/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isNegative, isPositive } from '@/domain/money';
import type { UserId } from '@/domain/types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTotalBalance } from '@/features/balances/hooks/useTotalBalance';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, PlusCircle, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: groups } = useGroups();
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const displayName: string = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

  const currentUserId = user?.id as UserId | undefined;
  const { youAreOwed, youOwe, netTotal, isLoading } = useTotalBalance(currentUserId);

  const handleAddExpense = () => {
    if (!groups || groups.length === 0) return;
    if (groups.length === 1) {
      navigate({ to: '/groups/$groupId/expenses/new', params: { groupId: groups[0].id } });
      return;
    }
    setShowGroupPicker((v) => !v);
  };

  const netColorClass = isPositive(netTotal)
    ? 'text-green-600'
    : isNegative(netTotal)
      ? 'text-destructive'
      : 'text-foreground';

  return (
    <div className="flex flex-col gap-6 p-4 pt-6">
      {/* Greeting */}
      <h1 className="text-2xl font-bold">{t('home.greeting', { name: displayName })}</h1>

      {/* Balance summary card */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          {/* Du bekommst */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('home.you_are_owed')}</span>
            {isLoading ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              <MoneyDisplay amount={youAreOwed} colored className="font-medium" />
            )}
          </div>

          {/* Du schuldest */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('home.you_owe')}</span>
            {isLoading ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              <MoneyDisplay amount={youOwe} colored className="font-medium" />
            )}
          </div>

          <div className="border-t" />

          {/* Gesamt */}
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t('home.total')}</span>
            {isLoading ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              <span className={`text-lg font-bold ${netColorClass}`}>
                <MoneyDisplay amount={netTotal} />
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add expense CTA */}
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="w-full gap-2"
          disabled={isLoading || !groups || groups.length === 0}
          onClick={handleAddExpense}
        >
          <PlusCircle className="h-5 w-5" />
          {t('home.add_expense')}
          {groups && groups.length > 1 && (
            <ChevronDown
              className={`ml-auto h-4 w-4 transition-transform ${showGroupPicker ? 'rotate-180' : ''}`}
            />
          )}
        </Button>

        {showGroupPicker && groups && (
          <Card>
            <CardContent className="p-2">
              <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">
                {t('home.pick_group')}
              </p>
              <div className="flex flex-col gap-1">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setShowGroupPicker(false);
                      navigate({
                        to: '/groups/$groupId/expenses/new',
                        params: { groupId: group.id },
                      });
                    }}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {group.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
