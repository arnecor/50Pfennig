/**
 * pages/AddFriendPage.tsx
 *
 * Route: /friends/add
 *
 * Entry point for adding friends — shows method selection.
 */

import { PageHeader } from '@components/shared/PageHeader';
import GuestUpgradeDialog from '@features/auth/components/GuestUpgradeDialog';
import { useAuth } from '@features/auth/hooks/useAuth';
import AddFriendMethodList from '@features/friends/components/AddFriendMethodList';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export default function AddFriendPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAnonymous } = useAuth();

  if (isAnonymous) {
    return <GuestUpgradeDialog variant="gate" />;
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title={t('friends.add_friend_title')}
        onBack={() => navigate({ to: '/friends' })}
      />

      <div className="px-5 py-5">
        <AddFriendMethodList />
      </div>
    </div>
  );
}
