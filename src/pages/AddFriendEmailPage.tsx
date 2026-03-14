/**
 * pages/AddFriendEmailPage.tsx
 *
 * Route: /friends/add/email
 */

import { PageHeader } from '@components/shared/PageHeader';
import EmailSearch from '@features/friends/components/EmailSearch';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export default function AddFriendEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <PageHeader
        title={t('friends.email_search_title')}
        onBack={() => navigate({ to: '/friends/add' })}
      />

      <div className="px-5 py-5">
        <EmailSearch />
      </div>
    </div>
  );
}
