/**
 * pages/ExpenseFormPage.tsx
 *
 * Route: /expenses/new  (optional search param: ?groupId=<uuid>)
 *
 * Loads all groups (for the participant picker) and all friends.
 * Passes an optional preselectedGroupId when navigated from a group context.
 *
 * On success:
 *   - Group expense → navigates to the group detail page
 *   - Friend expense → navigates to /home
 */

import { Button } from '@components/ui/button';
import type { GroupId, UserId } from '@domain/types';
import { useAuth } from '@features/auth/hooks/useAuth';
import ExpenseForm from '@features/expenses/components/ExpenseForm';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useGroups } from '@features/groups/hooks/useGroups';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ExpenseFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Optional groupId from search params (pre-selects that group in the picker)
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
    <div className="flex flex-col min-h-full">
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label={t('common.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('expenses.form.page_title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
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
