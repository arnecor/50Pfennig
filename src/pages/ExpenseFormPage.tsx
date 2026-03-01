/**
 * pages/ExpenseFormPage.tsx
 *
 * Routes:
 *   /groups/:groupId/expenses/new                 (create mode)
 *   /groups/:groupId/expenses/:expenseId/edit     (edit mode — future)
 *
 * Fetches the group (with members) and renders ExpenseForm.
 * On success navigates back to the group detail page.
 */

import { Button } from '@components/ui/button';
import type { GroupId, UserId } from '@domain/types';
import { useAuth } from '@features/auth/hooks/useAuth';
import ExpenseForm from '@features/expenses/components/ExpenseForm';
import { useGroup } from '@features/groups/hooks/useGroups';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ExpenseFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const { user } = useAuth();
  const { data: group, isLoading, isError } = useGroup(groupId as GroupId);

  const currentUserId = user?.id as UserId | undefined;
  const currentUserDisplayName: string =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

  const handleBack = () => {
    navigate({ to: '/groups/$groupId', params: { groupId } });
  };

  const handleSuccess = () => {
    navigate({ to: '/groups/$groupId', params: { groupId } });
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label={t('common.back')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('expenses.form.page_title')}</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {isLoading && (
          <div className="flex justify-center py-12">
            <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
          </div>
        )}

        {isError && (
          <div className="flex justify-center py-12">
            <span className="text-sm text-destructive">{t('common.error_generic')}</span>
          </div>
        )}

        {group && currentUserId && (
          <ExpenseForm
            group={group}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </div>
  );
}
