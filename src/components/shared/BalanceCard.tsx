import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatMoney, isNegative, isZero } from '@domain/money';
import type { Money } from '@domain/types';

type BalanceCardProps = {
  youAreOwed: Money;
  youOwe: Money;
  className?: string;
};

export function BalanceCard({ youAreOwed, youOwe, className }: BalanceCardProps) {
  const { t } = useTranslation();
  const total = (youAreOwed - youOwe) as Money;
  const positive = !isNegative(total);

  return (
    <div className={cn('text-center py-6', className)}>
      {/* Hero Total Balance */}
      <p className="text-sm text-muted-foreground mb-2">{t('home.total')}</p>
      <p
        className={cn(
          'text-4xl font-bold tracking-tight mb-4',
          positive ? 'text-owed-to-you' : 'text-you-owe',
        )}
      >
        {positive ? '+' : ''}
        {formatMoney(total)}
      </p>

      {/* Inline Breakdown */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-owed-to-you-muted flex items-center justify-center">
            <ArrowDownLeft className="w-3 h-3 text-owed-to-you" />
          </div>
          <span className="text-muted-foreground">{t('home.you_are_owed')}</span>
          <span className="font-semibold text-owed-to-you">
            {formatMoney(youAreOwed)}
          </span>
        </div>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-you-owe-muted flex items-center justify-center">
            <ArrowUpRight className="w-3 h-3 text-you-owe" />
          </div>
          <span className="text-muted-foreground">{t('home.you_owe')}</span>
          <span className="font-semibold text-you-owe">
            {formatMoney(youOwe)}
          </span>
        </div>
      </div>
    </div>
  );
}

type MiniBalanceProps = {
  amount: Money;
  label?: string;
  className?: string;
};

export function MiniBalance({ amount, label, className }: MiniBalanceProps) {
  const positive = !isNegative(amount);
  const zero = isZero(amount);

  return (
    <div className={cn('text-right', className)}>
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <p
        className={cn(
          'font-semibold',
          zero
            ? 'text-muted-foreground'
            : positive
              ? 'text-owed-to-you'
              : 'text-you-owe',
        )}
      >
        {zero ? formatMoney(amount) : `${positive ? '+' : ''}${formatMoney(amount)}`}
      </p>
    </div>
  );
}
