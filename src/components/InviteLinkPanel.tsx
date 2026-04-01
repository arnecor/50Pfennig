/**
 * components/InviteLinkPanel.tsx
 *
 * Shared invite-link display used by both friend invites (AddFriendMethodList)
 * and group invites (AddMemberOverlay share section).
 *
 * The parent is responsible for creating the invite token and passing the
 * resulting URL down. This component only handles display, copy, share, and
 * the inline QR toggle.
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Button } from '@components/ui/button';
import { Check, Copy, Loader2, QrCode, Share2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  /** The full invite URL to display and share. Null while the token is loading. */
  inviteUrl: string | null;
  /** Whether the invite token is still being created. */
  isLoading: boolean;
  /** Text sent to the OS share sheet alongside the URL (e.g. "Tritt meiner Gruppe bei"). */
  shareText: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InviteLinkPanel({ inviteUrl, isLoading, shareText }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render QR code whenever the canvas becomes visible and the URL is ready
  useEffect(() => {
    if (showQR && inviteUrl && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, inviteUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    }
  }, [showQR, inviteUrl]);

  async function handleCopyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareLink() {
    if (!inviteUrl) return;
    setSharing(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'Sharli', text: shareText, url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled share sheet — no action needed
    } finally {
      setSharing(false);
    }
  }

  const linkReady = !!inviteUrl;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Invite link box ── */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t('invites.link_label')}</p>
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <span className="flex-1 truncate text-sm font-mono text-foreground">
              {inviteUrl ?? '—'}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={!linkReady}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label={t('invites.copy_link')}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('invites.valid_days')}</p>
      </div>

      {/* ── Share + QR buttons ── */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="default"
          className="flex h-auto flex-col gap-1.5 py-4"
          onClick={handleShareLink}
          disabled={!linkReady || sharing}
        >
          {sharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
          <span className="text-sm font-medium">{t('invites.share_link')}</span>
        </Button>

        <Button
          variant="outline"
          className="flex h-auto flex-col gap-1.5 py-4"
          onClick={() => setShowQR((prev) => !prev)}
          disabled={!linkReady}
        >
          {showQR ? <X className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
          <span className="text-sm font-medium">
            {showQR ? t('common.close') : t('invites.show_qr')}
          </span>
        </Button>
      </div>

      {/* ── Inline QR code ── */}
      {showQR && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <canvas ref={qrCanvasRef} />
          </div>
          <p className="text-center text-sm text-muted-foreground">{t('invites.qr_scan_hint')}</p>
        </div>
      )}
    </div>
  );
}
