/**
 * pages/AddFriendQRPage.tsx
 *
 * Route: /friends/add/qr
 *
 * Shows a QR code containing an invite link for in-person friend adding.
 */

import QRCodeDisplay from '@features/friends/components/QRCodeDisplay';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AddFriendQRPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <button
          type="button"
          onClick={() => navigate({ to: '/friends/add' })}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">{t('friends.qr_title')}</h1>
      </header>

      <QRCodeDisplay />
    </div>
  );
}
