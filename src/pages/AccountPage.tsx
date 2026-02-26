/**
 * pages/AccountPage.tsx
 *
 * Route: /account
 *
 * Profile and account settings. Sign out.
 *
 * TODO: Implement profile display and sign out button.
 */

import { useTranslation } from 'react-i18next';

export default function AccountPage() {
  const { t } = useTranslation();

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">{t('account.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('account.placeholder_description')}</p>
    </div>
  );
}
