/**
 * pages/AddFriendQRPage.tsx
 *
 * Route: /friends/add/qr
 */

import { PageHeader } from '@components/shared/PageHeader';
import QRCodeDisplay from '@features/friends/components/QRCodeDisplay';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export default function AddFriendQRPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <PageHeader
        title={t('friends.qr_title')}
        onBack={() => navigate({ to: '/friends/add' })}
      />
      <QRCodeDisplay />
    </div>
  );
}
