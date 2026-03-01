/**
 * features/groups/components/GroupList.tsx
 *
 * Renders the list of groups the current user belongs to.
 * Each item shows the group name, member count, and the user's net balance
 * in that group (derived — not fetched separately).
 *
 * Empty state: prompt to create the first group.
 * Loading state: skeleton cards.
 */

import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui/button';
import EmptyState from '@components/shared/EmptyState';
import { useGroups } from '../hooks/useGroups';
import GroupCard from './GroupCard';

function GroupCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export default function GroupList() {
  const { t } = useTranslation();
  const { data: groups, isLoading } = useGroups();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title={t('groups.empty_title')}
        description={t('groups.empty_description')}
        action={
          <Button disabled>
            {t('groups.create')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}
