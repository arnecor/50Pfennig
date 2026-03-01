/**
 * pages/HomePage.tsx
 *
 * Route: /home
 *
 * Landing screen for authenticated users. Shows a personal greeting and a
 * cross-group + cross-friend balance summary (total owed, total owing, net).
 * Single CTA button navigates to /expenses/new.
 */

import MoneyDisplay from '@/components/shared/MoneyDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isNegative, isPositive } from '@/domain/money';
import type { UserId } from '@/domain/types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTotalBalance } from '@/features/balances/hooks/useTotalBalance';
import { useNavigate } from '@tanstack/react-router';
import { PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName: string = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
  const currentUserId = user?.id as UserId | undefined;
  const { youAreOwed, youOwe, netTotal, isLoading } = useTotalBalance(currentUserId);

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
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('home.you_are_owed')}</span>
            {isLoading ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              <MoneyDisplay amount={youAreOwed} colored className="font-medium" />
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('home.you_owe')}</span>
            {isLoading ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              <MoneyDisplay amount={youOwe} colored className="font-medium" />
            )}
          </div>

          <div className="border-t" />

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
      <Button
        size="lg"
        className="w-full gap-2"
        onClick={() => navigate({ to: '/expenses/new', search: { groupId: undefined } })}
      >
        <PlusCircle className="h-5 w-5" />
        {t('home.add_expense')}
      </Button>
    </div>
  );
}
