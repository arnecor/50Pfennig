/**
 * pages/CreateGroupPage.tsx
 *
 * Route: /groups/new
 */

import { PageHeader } from '@components/shared/PageHeader';
import type { GroupId } from '@domain/types';
import CreateGroupForm from '@features/groups/components/CreateGroupForm';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export default function CreateGroupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: friends = [], isLoading: friendsLoading } = useFriends();

  const handleBack = () => navigate({ to: '/groups' });

  const handleSuccess = (groupId: GroupId) => {
    navigate({ to: '/groups/$groupId', params: { groupId } });
  };

  return (
    <div className="min-h-full">
      <PageHeader title={t('groups.create_title')} onBack={handleBack} />

      <div className="px-5 py-5">
        {friendsLoading ? (
          <div className="flex justify-center py-12">
            <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
          </div>
        ) : (
          <CreateGroupForm friends={friends} onSuccess={handleSuccess} />
        )}
      </div>
    </div>
  );
}
