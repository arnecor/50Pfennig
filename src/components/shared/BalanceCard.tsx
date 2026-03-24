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

      {/* Two-column breakdown cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* You are owed */}
        <div className="rounded-2xl bg-owed-to-you-muted px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-owed-to-you/15 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-3 h-3 text-owed-to-you" />
            </div>
            <span className="text-xs font-medium text-owed-to-you leading-tight">
              {t('home.you_are_owed')}
            </span>
          </div>
          <p className="text-xl font-bold text-owed-to-you tracking-tight">
            {formatMoney(youAreOwed)}
          </p>
        </div>

        {/* You owe */}
        <div className="rounded-2xl bg-you-owe-muted px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-you-owe/15 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-3 h-3 text-you-owe" />
            </div>
            <span className="text-xs font-medium text-you-owe leading-tight">
              {t('home.you_owe')}
            </span>
          </div>
          <p className="text-xl font-bold text-you-owe tracking-tight">
            {formatMoney(youOwe)}
          </p>
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
