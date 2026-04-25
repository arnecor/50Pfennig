/**
 * features/groups/components/AddMemberOverlay.tsx
 *
 * Bottom-sheet overlay for adding friends to a group and sharing the group.
 *
 * Sections:
 *   1. "Freunde hinzufügen" — multi-select list of friends not yet in the group.
 *      Confirm button adds selected friends and closes the sheet.
 *   2. "Gruppe teilen" — invite link with copy, share, and inline QR code.
 *      Token is created lazily on first render of this section.
 *
 * Uses the same fixed-overlay pattern as ParticipantPicker (no Dialog — not installed).
 */

import InviteLinkPanel from '@components/InviteLinkPanel';
import { Button } from '@components/ui/button';
import type { Friend, Group, GroupId, UserId } from '@domain/types';
import { useCreateGroupInvite } from '@features/groups/hooks/useCreateGroupInvite';
import { getInviteUrl } from '@features/invites/utils/getInviteUrl';
import { useBackHandler } from '@lib/capacitor/backHandler';
import { CheckSquare, Square, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  group: Group;
  friends: Friend[];
  onAddMembers: (userIds: UserId[]) => void;
  isPending: boolean;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddMemberOverlay({
  group,
  friends,
  onAddMembers,
  isPending,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const createGroupInvite = useCreateGroupInvite();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useBackHandler(() => {
    onClose();
    return true;
  });

  // Create invite token lazily on first mount of the share section
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect — mutation must run exactly once
  useEffect(() => {
    createGroupInvite
      .mutateAsync(group.id as GroupId)
      .then((invite) => setInviteUrl(getInviteUrl('group', invite.token)));
  }, []);

  const existingMemberIds = useMemo(
    () => new Set(group.members.map((m) => m.userId)),
    [group.members],
  );

  // Friends not yet in the group. Deleted users are never offered as
  // candidates — they cannot be invited to new groups.
  const addableFriends = useMemo(
    () => friends.filter((f) => !f.isDeleted && !existingMemberIds.has(f.userId)),
    [friends, existingMemberIds],
  );

  const [selected, setSelected] = useState<UserId[]>([]);

  function handleToggle(userId: UserId) {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function handleConfirm() {
    if (selected.length === 0) return;
    onAddMembers(selected);
  }

  return (
    <>
      {/* Backdrop — above the nav bar (z-50) */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is aria-hidden, keyboard users interact via the sheet's close button */}
      <div className="fixed inset-0 z-[55] bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Sheet — sits above backdrop and nav bar */}
      <div
        className="fixed left-0 right-0 z-[60] flex flex-col rounded-t-2xl bg-background shadow-xl"
        style={{
          bottom: 0,
          maxHeight: 'min(85dvh, calc(100vh - env(safe-area-inset-top, 24px)))',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-base font-semibold">{t('groups.overlay_title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label={t('common.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Section 1 — Add friends */}
          <section className="mb-6">
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('groups.add_friends_section')}
            </p>

            {addableFriends.length === 0 && friends.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('groups.no_friends_at_all')}
              </p>
            )}

            {addableFriends.length === 0 && friends.length > 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('groups.all_friends_in_group')}
              </p>
            )}

            {addableFriends.length > 0 && (
              <div className="flex flex-col gap-1">
                {addableFriends.map((friend) => {
                  const isChecked = selected.includes(friend.userId);
                  return (
                    <button
                      key={friend.userId}
                      type="button"
                      onClick={() => handleToggle(friend.userId)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted
                        ${isChecked ? 'text-primary font-medium' : 'text-foreground'}
                      `}
                    >
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 text-left">{friend.displayName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 2 — Share group via invite link */}
          <section className="mb-4">
            <p className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('groups.share_section')}
            </p>
            <InviteLinkPanel
              inviteUrl={inviteUrl}
              isLoading={createGroupInvite.isPending}
              shareText={t('groups.invite_share_text', { groupName: group.name })}
            />
          </section>
        </div>

        {/* Confirm footer — only shown when friends can be added */}
        {addableFriends.length > 0 && (
          <div className="border-t px-4 pt-4 pb-safe">
            <Button
              size="lg"
              className="w-full gap-2"
              disabled={selected.length === 0 || isPending}
              onClick={handleConfirm}
            >
              <UserPlus className="h-4 w-4" />
              {isPending
                ? t('common.loading')
                : t('groups.add_member_confirm', { count: selected.length })}
            </Button>
          </div>
        )}

        {/* Bottom safe area padding when no footer button */}
        {addableFriends.length === 0 && (
          <div className="pb-safe" />
        )}
      </div>
    </>
  );
}
