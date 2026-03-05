/**
 * features/friends/components/AddFriendMethodList.tsx
 *
 * Main "Add Friend" screen showing four action cards:
 *   1. Share invite link (via native Share Sheet)
 *   2. Show QR code (navigates to /friends/add/qr)
 *   3. Scan QR code (navigates to /friends/add/scan, native only)
 *   4. Search by email (navigates to /friends/add/email)
 *
 * The "share link" action is handled inline — it creates an invite token,
 * opens the Share Sheet, and shows success/error state on this page.
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Card, CardContent } from '@components/ui/card';
import { useCreateInvite } from '@features/friends/hooks/useCreateInvite';
import { useNavigate } from '@tanstack/react-router';
import { Check, Camera, Link2, Loader2, Mail, QrCode } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function getInviteUrl(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/invite/${token}`;
}

export default function AddFriendMethodList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createInvite = useCreateInvite();

  const [linkShared, setLinkShared] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShareLink() {
    setSharing(true);
    try {
      // Reuse existing token if we already created one
      const invite = lastToken
        ? { token: lastToken }
        : await createInvite.mutateAsync();

      if (!lastToken) setLastToken(invite.token);

      const url = getInviteUrl(invite.token);

      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: '50Pfennig',
          text: t('friends.invite_share_text', { url }),
          url,
        });
      } else {
        // Web fallback: copy to clipboard
        await navigator.clipboard.writeText(url);
      }

      setLinkShared(true);
    } catch {
      // User cancelled share sheet or error — no action needed
    } finally {
      setSharing(false);
    }
  }

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="space-y-3">
      {/* Link shared success state */}
      {linkShared && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-800 dark:text-green-200">
                  {t('friends.invite_shared')}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {t('friends.invite_valid_days')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setLinkShared(false); handleShareLink(); }}
              className="mt-3 text-sm font-medium text-green-700 underline dark:text-green-300"
            >
              {t('friends.invite_share_again')}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Share link */}
      {!linkShared && (
        <MethodCard
          icon={sharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
          title={t('friends.method_share_link')}
          description={t('friends.method_share_link_desc')}
          onClick={handleShareLink}
          disabled={sharing}
        />
      )}

      {/* Show QR */}
      <MethodCard
        icon={<QrCode className="h-5 w-5" />}
        title={t('friends.method_show_qr')}
        description={t('friends.method_show_qr_desc')}
        onClick={() => navigate({ to: '/friends/add/qr' })}
      />

      {/* Scan QR (native only) */}
      {isNative && (
        <MethodCard
          icon={<Camera className="h-5 w-5" />}
          title={t('friends.method_scan_qr')}
          description={t('friends.method_scan_qr_desc')}
          onClick={() => navigate({ to: '/friends/add/scan' })}
        />
      )}

      {/* Email search */}
      <MethodCard
        icon={<Mail className="h-5 w-5" />}
        title={t('friends.method_email_search')}
        description={t('friends.method_email_search_desc')}
        onClick={() => navigate({ to: '/friends/add/email' })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable action card
// ---------------------------------------------------------------------------

function MethodCard({
  icon,
  title,
  description,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer active:opacity-80 transition-opacity ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
