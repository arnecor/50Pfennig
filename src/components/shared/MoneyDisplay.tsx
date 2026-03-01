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
 *
 * Uses formatMoney() from domain/money.ts internally.
 * Locale and currency are read from the i18n context (de-DE / EUR for now).
 */

import { useTranslation } from 'react-i18next';
import { formatMoney, isPositive, isNegative } from '@/domain/money';
import type { Money } from '@/domain/types';

type MoneyDisplayProps = {
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
}: MoneyDisplayProps) {
  const { i18n } = useTranslation();

  const locale = i18n.language === 'en' ? 'en-GB' : 'de-DE';
  const formatted = formatMoney(amount, locale);
  const display = showSign && isPositive(amount) ? `+${formatted}` : formatted;

  let colorClass = '';
  if (colored) {
    if (isPositive(amount)) colorClass = 'text-green-600';
    else if (isNegative(amount)) colorClass = 'text-destructive';
  }

  return (
    <span className={[colorClass, className].filter(Boolean).join(' ')}>
      {display}
    </span>
  );
}
