/**
 * pages/AddFriendQRPage.tsx
 *
 * Route: /friends/add/qr
 */

import { PageHeader } from '@components/shared/PageHeader';
import GuestUpgradeDialog from '@features/auth/components/GuestUpgradeDialog';
import { useAuth } from '@features/auth/hooks/useAuth';
import QRCodeDisplay from '@features/friends/components/QRCodeDisplay';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export default function AddFriendQRPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAnonymous } = useAuth();

  if (isAnonymous) {
    return <GuestUpgradeDialog variant="gate" />;
  }

  return (
    <div className="min-h-full">
      <PageHeader title={t('friends.qr_title')} onBack={() => navigate({ to: '/friends/add' })} />
      <QRCodeDisplay />
    </div>
  );
}
