/**
 * pages/GroupsPage.tsx
 *
 * Route: /groups
 *
 * The home screen. Shows the list of groups the current user belongs to,
 * each with a net balance summary. FAB or header button to create a group.
 */

import { useAuth } from '../features/auth/hooks/useAuth';

export default function GroupsPage() {
  const { user } = useAuth();

  return (
    <div>
      <p>Logged in as: {user?.email}</p>
      <p>User ID: {user?.id}</p>
    </div>
  );
}
