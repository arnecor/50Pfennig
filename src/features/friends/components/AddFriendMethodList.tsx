/**
 * features/friends/components/AddFriendMethodList.tsx
 *
 * "Add Friend" screen:
 *   - Invite link displayed prominently at top (via InviteLinkPanel)
 *   - Scan QR (native only)
 *   - Email search as a smaller secondary option at the bottom
 */

import { Capacitor } from '@capacitor/core';
import InviteLinkPanel from '@components/InviteLinkPanel';
import { useCreateInvite } from '@features/friends/hooks/useCreateInvite';
import { getInviteUrl } from '@features/friends/utils/getInviteUrl';
import { useNavigate } from '@tanstack/react-router';
import { Camera, ChevronRight, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function AddFriendMethodList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createInvite = useCreateInvite();

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  // Create invite on mount so the link is immediately visible
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect — mutation must run exactly once
  useEffect(() => {
    createInvite.mutateAsync().then((invite) => {
      setInviteUrl(getInviteUrl(invite.token));
    });
  }, []);

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="flex flex-col gap-6">
      {/* ── Invite link panel (copy / share / QR) ── */}
      <InviteLinkPanel
        inviteUrl={inviteUrl}
        isLoading={createInvite.isPending}
        shareText={t('friends.invite_share_text', { url: inviteUrl ?? '' })}
      />

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
