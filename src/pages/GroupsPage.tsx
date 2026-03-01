/**
 * pages/GroupsPage.tsx
 *
 * Route: /groups
 *
 * Shows the list of groups the current user belongs to,
 * each with a net balance summary.
 * "Ausgabe hinzufügen" button at the bottom navigates to /expenses/new.
 */

import { Plus, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@components/ui/button';
import GroupList from '@features/groups/components/GroupList';

export default function GroupsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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

      <div className="border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={() => navigate({ to: '/expenses/new', search: { groupId: undefined } })}
        >
          <PlusCircle className="h-5 w-5" />
          {t('expenses.add')}
        </Button>
      </div>
    </div>
  );
}
