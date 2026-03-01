/**
 * pages/FriendsPage.tsx
 *
 * Route: /friends
 *
 * Placeholder page for the Friends tab. Will eventually show per-friend
 * balances and a friend expense overview (similar to Splitwise).
 *
 * Adding friends (by email, phone, QR) is not yet implemented.
 */

import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function FriendsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 py-4">
        <h1 className="text-xl font-semibold">{t('friends.title')}</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <UserRound className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-base font-medium">{t('friends.empty_title')}</p>
        <p className="text-sm text-muted-foreground">{t('friends.empty_description')}</p>
      </div>
    </div>
  );
}
