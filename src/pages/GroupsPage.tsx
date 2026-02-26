/**
 * pages/GroupsPage.tsx
 *
 * Route: /groups
 *
 * The home screen. Shows the list of groups the current user belongs to,
 * each with a net balance summary. FAB or header button to create a group.
 */

import { useAuth } from '../features/auth/hooks/useAuth';
import { useTranslation } from 'react-i18next';

export default function GroupsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (

    <div className="p-4">
      <h1 className="text-xl font-semibold">{t('groups.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('groups.placeholder_description')}</p>
      <div>
        <p>Logged in as: {user?.email}</p>
        <p>User ID: {user?.id}</p>
      </div>
    </div>


  );
}
