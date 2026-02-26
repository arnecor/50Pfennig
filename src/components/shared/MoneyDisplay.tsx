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

// TODO: Implement

export default function MoneyDisplay() {
  return null;
}
