/**
 * features/friends/components/QRCodeDisplay.tsx
 *
 * Displays an invite URL as a QR code for in-person friend adding.
 * Creates an invite token on mount, renders the QR, and shows a
 * "share link instead" fallback button.
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Button } from '@components/ui/button';
import { useCreateInvite } from '@features/friends/hooks/useCreateInvite';
import { Link2, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';

function getInviteUrl(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/invite/${token}`;
}

export default function QRCodeDisplay() {
  const { t } = useTranslation();
  const createInvite = useCreateInvite();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  // Create invite on mount
  useEffect(() => {
    createInvite.mutateAsync().then((invite) => {
      const url = getInviteUrl(invite.token);
      setInviteUrl(url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render QR code when URL is available
  useEffect(() => {
    if (inviteUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, inviteUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    }
  }, [inviteUrl]);

  async function handleShareLink() {
    if (!inviteUrl) return;

    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: '50Pfennig',
        text: t('friends.invite_share_text', { url: inviteUrl }),
        url: inviteUrl,
      });
    } else {
      await navigator.clipboard.writeText(inviteUrl);
    }
  }

  if (createInvite.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (createInvite.isError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-center text-sm text-destructive">
          {t('friends.invite_error_generic')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <canvas ref={canvasRef} />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t('friends.qr_scan_hint')}
      </p>

      <Button variant="outline" className="gap-2" onClick={handleShareLink}>
        <Link2 className="h-4 w-4" />
        {t('friends.qr_share_instead')}
      </Button>

      <p className="text-xs text-muted-foreground">
        {t('friends.invite_valid_days')}
      </p>
    </div>
  );
}
