/**
 * features/friends/components/AddFriendMethodList.tsx
 *
 * Redesigned "Add Friend" screen:
 *   - Invite link displayed prominently at top with copy button
 *   - Share + QR buttons side by side
 *   - Scan QR (native only, below main buttons)
 *   - Email search as a smaller secondary option at the bottom
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Button } from '@components/ui/button';
import { useCreateInvite } from '@features/friends/hooks/useCreateInvite';
import { useNavigate } from '@tanstack/react-router';
import { Camera, Check, ChevronRight, Copy, Loader2, Mail, QrCode, Share2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

function getInviteUrl(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/invite/${token}`;
}

export default function AddFriendMethodList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createInvite = useCreateInvite();

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Create invite on mount so the link is immediately visible
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect — mutation must run exactly once
  useEffect(() => {
    createInvite.mutateAsync().then((invite) => {
      setInviteUrl(getInviteUrl(invite.token));
    });
  }, []);

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
        await Share.share({
          title: 'Sharli',
          text: t('friends.invite_share_text', { url: inviteUrl }),
          url: inviteUrl,
        });
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

  const isNative = Capacitor.isNativePlatform();
  const linkReady = !!inviteUrl;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Invite link box ── */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t('friends.invite_link_label')}
        </p>
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5">
          {createInvite.isPending ? (
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
            aria-label={t('friends.copy_link')}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('friends.invite_valid_days')}</p>
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
          <span className="text-sm font-medium">{t('friends.method_share_link')}</span>
        </Button>

        <Button
          variant="outline"
          className="flex h-auto flex-col gap-1.5 py-4"
          onClick={() => setShowQR((prev) => !prev)}
          disabled={!linkReady}
        >
          {showQR ? <X className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
          <span className="text-sm font-medium">
            {showQR ? t('common.close') : t('friends.method_show_qr')}
          </span>
        </Button>
      </div>

      {/* ── Inline QR code ── */}
      {showQR && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <canvas ref={qrCanvasRef} />
          </div>
          <p className="text-center text-sm text-muted-foreground">{t('friends.qr_scan_hint')}</p>
        </div>
      )}

      {/* ── Scan QR (native only) ── */}
      {isNative && (
        <button
          type="button"
          onClick={() => navigate({ to: '/friends/add/scan' })}
          className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/50 active:opacity-80"
        >
          <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">{t('friends.method_scan_qr')}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* ── Divider ── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">oder</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ── Email search ── */}
      <button
        type="button"
        onClick={() => navigate({ to: '/friends/add/email' })}
        className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/50 active:opacity-80"
      >
        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">{t('friends.method_email_search')}</p>
          <p className="text-xs text-muted-foreground">{t('friends.method_email_search_desc')}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
