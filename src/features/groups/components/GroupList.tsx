/**
 * features/groups/components/GroupList.tsx
 *
 * Renders the list of groups the current user belongs to.
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui/button';
import EmptyState from '@components/shared/EmptyState';
import { useGroups } from '../hooks/useGroups';
import GroupCard from './GroupCard';

function GroupCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
      <div className="w-12 h-12 rounded-xl bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-16 animate-pulse rounded bg-muted shrink-0" />
    </div>
  );
}

type Props = {
  onCreateGroup?: () => void;
};

export default function GroupList({ onCreateGroup }: Props) {
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
        title={t('groups.empty_title')}
        description={t('groups.empty_description')}
        action={
          <Button onClick={onCreateGroup}>
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
