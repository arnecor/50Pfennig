/**
 * pages/CreateGroupPage.tsx
 *
 * Route: /groups/new
 *
 * Loads the current user's friends (for the optional member picker).
 * On success: navigates to the newly created group's detail page.
 */

import { Button } from '@components/ui/button';
import type { GroupId } from '@domain/types';
import CreateGroupForm from '@features/groups/components/CreateGroupForm';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
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
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label={t('common.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('groups.create_title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
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
