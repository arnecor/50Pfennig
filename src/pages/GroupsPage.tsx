/**
 * pages/GroupsPage.tsx
 *
 * Route: /groups
 *
 * Shows the list of groups the current user belongs to,
 * each with a net balance summary.
 */

import { FloatingActionButton } from '@components/shared/FloatingActionButton';
import { PageHeader } from '@components/shared/PageHeader';
import GroupList from '@features/groups/components/GroupList';
import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function GroupsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleCreateGroup = () => navigate({ to: '/groups/new' });

  return (
    <div className="min-h-full pb-24">
      <PageHeader
        title={t('groups.title')}
        variant="large"
        onAction={handleCreateGroup}
        actionIcon={<Plus className="w-5 h-5" />}
        actionLabel={t('groups.create')}
      />

      <div className="px-5">
        <GroupList onCreateGroup={handleCreateGroup} />
      </div>

      <FloatingActionButton
        onClick={() => navigate({ to: '/expenses/new', search: { groupId: undefined } })}
        label={t('expenses.add')}
      />
    </div>
  );
}
