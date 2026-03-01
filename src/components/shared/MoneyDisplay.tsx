/**
 * components/shared/MoneyDisplay.tsx
 *
 * The single place where Money values are formatted for display.
 * Always use this component — never call formatMoney() directly in JSX.
 *
 * Props:
 *   amount:    Money      — the value to display
 *   showSign?: boolean    — prefix '+' for positive values (default: false)
 *   colored?:  boolean    — green if positive, red if negative (default: false)
 *   className?: string    — additional Tailwind classes
 */

import { formatMoney, isPositive, isNegative } from '@domain/money';
import type { Money } from '@domain/types';
import { cn } from '@/lib/utils';

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
      ? 'text-green-600'
      : isNegative(amount)
        ? 'text-red-600'
        : 'text-muted-foreground'
    : '';

  return <span className={cn(colorClass, className)}>{formatted}</span>;
}
