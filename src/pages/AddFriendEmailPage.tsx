/**
 * pages/AddFriendEmailPage.tsx
 *
 * Route: /friends/add/email
 *
 * Search for registered users by email and add them as friends.
 */

import EmailSearch from '@features/friends/components/EmailSearch';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AddFriendEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <button
          type="button"
          onClick={() => navigate({ to: '/friends/add' })}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">{t('friends.email_search_title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <EmailSearch />
      </div>
    </div>
  );
}
