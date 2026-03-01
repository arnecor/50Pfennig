/**
 * pages/GroupsPage.tsx
 *
 * Route: /groups
 *
 * The home screen. Shows the list of groups the current user belongs to,
 * each with a net balance summary. FAB or header button to create a group.
 */

import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui/button';
import GroupList from '@features/groups/components/GroupList';

export default function GroupsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-4">
        <h1 className="text-xl font-semibold">{t('groups.title')}</h1>
        <Button size="icon" variant="ghost" disabled aria-label={t('groups.create')}>
          <Plus className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <GroupList />
      </div>
    </div>
  );
}
