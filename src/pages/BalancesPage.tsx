/**
 * pages/BalancesPage.tsx
 *
 * Route: /balances
 *
 * Shows what you owe friends and what friends owe you, across all groups.
 * Balances are derived from TanStack Query cached data — no direct fetches here.
 *
 * TODO: Implement cross-group person-level balance view.
 */

import { useTranslation } from 'react-i18next';

export default function BalancesPage() {
  const { t } = useTranslation();

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">{t('balances.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('balances.placeholder_description')}</p>
    </div>
  );
}
