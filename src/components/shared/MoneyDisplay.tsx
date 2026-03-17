/**
 * components/shared/MoneyDisplay.tsx
 *
 * The single place where Money values are formatted for display.
 * Always use this component — never call formatMoney() directly in JSX.
 */

import { cn } from '@/lib/utils';
import { formatMoney, isNegative, isPositive } from '@domain/money';
import type { Money } from '@domain/types';

type Props = {
  amount: Money;
  showSign?: boolean;
  colored?: boolean;
  className?: string;
};

export default function MoneyDisplay({
  amount,
  showSign = false,
  colored = false,
  className,
}: Props) {
  const formatted = showSign
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        signDisplay: 'always',
      }).format(amount / 100)
    : formatMoney(amount);

  const colorClass = colored
    ? isPositive(amount)
      ? 'text-owed-to-you'
      : isNegative(amount)
        ? 'text-you-owe'
        : 'text-muted-foreground'
    : '';

  return <span className={cn(colorClass, className)}>{formatted}</span>;
}
