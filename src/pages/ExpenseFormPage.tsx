/**
 * pages/ExpenseFormPage.tsx
 *
 * Route: /expenses/new  (optional search param: ?groupId=<uuid>)
 */

import { PageHeader } from '@components/shared/PageHeader';
import type { GroupId, UserId } from '@domain/types';
import { useAuth } from '@features/auth/hooks/useAuth';
import ExpenseForm from '@features/expenses/components/ExpenseForm';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useGroups } from '@features/groups/hooks/useGroups';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export default function ExpenseFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const search = useSearch({ strict: false }) as { groupId?: string };
  const preselectedGroupId = search.groupId as GroupId | undefined;

  const { user } = useAuth();
  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const { data: friends = [], isLoading: friendsLoading } = useFriends();

  const currentUserId = user?.id as UserId | undefined;
  const currentUserDisplayName: string =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

  const isLoading = groupsLoading || friendsLoading;

  const handleBack = () => navigate({ to: '/home' });

  const handleSuccess = (selectedGroupId: GroupId | null) => {
    if (selectedGroupId) {
      navigate({ to: '/groups/$groupId', params: { groupId: selectedGroupId } });
    } else {
      navigate({ to: '/home' });
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title={t('expenses.form.page_title')}
        onBack={handleBack}
      />

      <div className="px-5 py-5 pb-10">
        {isLoading && (
          <div className="flex justify-center py-12">
            <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
          </div>
        )}

        {!isLoading && currentUserId && (
          <ExpenseForm
            groups={groups}
            friends={friends}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            {...(preselectedGroupId != null && { preselectedGroupId })}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </div>
  );
}
