/**
 * components/shared/MoneyDisplay.tsx
 *
 * The single place where Money values are formatted for display.
 * Always use this component — never call formatMoney() directly in JSX.
 */

import { cn } from '@/lib/utils';
import { formatMoney, isNegative, isPositive } from '@domain/money';
import type { CurrencyCode } from '@domain/types';
import type { Money } from '@domain/types';
import { useTranslation } from 'react-i18next';

type Props = {
  amount: Money;
  showSign?: boolean;
  colored?: boolean;
  className?: string;
  currency?: CurrencyCode;
};

export default function MoneyDisplay({
  amount,
  showSign = false,
  colored = false,
  className,
  currency,
}: Props) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : 'en-GB';
  const curr = (currency as string) ?? 'EUR';

  const formatted = showSign
    ? new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: curr,
        signDisplay: 'always',
      }).format(amount / 100)
    : formatMoney(amount, locale, curr);

  const colorClass = colored
    ? isPositive(amount)
      ? 'text-owed-to-you'
      : isNegative(amount)
        ? 'text-you-owe'
        : 'text-muted-foreground'
    : '';

  return <span className={cn(colorClass, className)}>{formatted}</span>;
}
