/**
 * pages/AddFriendScanPage.tsx
 *
 * Route: /friends/add/scan
 *
 * Full-screen QR code scanner for scanning a friend's invite QR code.
 * Native only — the route should only be reachable on native platforms.
 */

import QRCodeScanner from '@features/friends/components/QRCodeScanner';
import { useNavigate } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AddFriendScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <button
          type="button"
          onClick={() => navigate({ to: '/friends/add' })}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold">{t('friends.scan_title')}</h1>
        <div className="w-7" /> {/* Spacer for centering */}
      </header>

      <QRCodeScanner />
    </div>
  );
}
