/**
 * pages/AddFriendPage.tsx
 *
 * Route: /friends/add
 *
 * Entry point for adding friends — shows method selection
 * (share link, QR code, scan QR, email search).
 */

import AddFriendMethodList from '@features/friends/components/AddFriendMethodList';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AddFriendPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <button
          type="button"
          onClick={() => navigate({ to: '/friends' })}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">{t('friends.add_friend_title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AddFriendMethodList />
      </div>
    </div>
  );
}
