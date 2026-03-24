import { cn } from '@/lib/utils';
import { formatMoney, isNegative, isZero } from '@domain/money';
import type { Money } from '@domain/types';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    <div className={cn('py-6', className)}>
      {/* Hero Total Balance */}
      <div className="text-center mb-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
          {t('home.total')}
        </p>
        <p
          className={cn(
            'text-5xl font-bold tracking-tight',
            positive ? 'text-owed-to-you' : 'text-you-owe',
          )}
        >
          {positive ? '+' : ''}
          {formatMoney(total)}
        </p>
      </div>

      {/* Two-column breakdown — amount on top, label below */}
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* You are owed */}
        <div className="flex flex-col items-center gap-1 pr-4">
          <div className="flex items-baseline gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-owed-to-you self-center shrink-0" />
            <span className="text-xl font-bold text-owed-to-you tracking-tight">
              {formatMoney(youAreOwed)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground text-center leading-tight">
            {t('home.you_are_owed')}
          </span>
        </div>

        {/* You owe */}
        <div className="flex flex-col items-center gap-1 pl-4">
          <div className="flex items-baseline gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-you-owe self-center shrink-0" />
            <span className="text-xl font-bold text-you-owe tracking-tight">
              {formatMoney(youOwe)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground text-center leading-tight">
            {t('home.you_owe')}
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
          zero ? 'text-muted-foreground' : positive ? 'text-owed-to-you' : 'text-you-owe',
        )}
      >
        {zero ? formatMoney(amount) : `${positive ? '+' : ''}${formatMoney(amount)}`}
      </p>
    </div>
  );
}
