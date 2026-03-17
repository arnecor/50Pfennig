/**
 * features/groups/components/AddMemberOverlay.tsx
 *
 * Bottom-sheet overlay for adding friends to a group and sharing the group.
 *
 * Sections:
 *   1. "Freunde hinzufügen" — multi-select list of friends not yet in the group.
 *      Confirm button adds selected friends and closes the sheet.
 *   2. "Gruppe teilen" — placeholder buttons for link sharing and QR code
 *      (not yet implemented, shown disabled with a "coming soon" hint).
 *
 * Uses the same fixed-overlay pattern as ParticipantPicker (no Dialog — not installed).
 */

import { Button } from '@components/ui/button';
import type { Friend, Group, UserId } from '@domain/types';
import { CheckSquare, Link2, QrCode, Square, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
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

  const existingMemberIds = useMemo(
    () => new Set(group.members.map((m) => m.userId)),
    [group.members],
  );

  // Friends not yet in the group
  const addableFriends = useMemo(
    () => friends.filter((f) => !existingMemberIds.has(f.userId)),
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
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is aria-hidden, keyboard users interact via the sheet's close button */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background shadow-xl"
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

          {/* Section 2 — Share group (placeholders) */}
          <section className="mb-4">
            <p className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('groups.share_section')}
            </p>
            <p className="mb-3 text-xs text-muted-foreground">{t('groups.share_coming_soon')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <Link2 className="h-4 w-4" />
                {t('groups.share_link')}
              </button>
              <button
                type="button"
                disabled
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <QrCode className="h-4 w-4" />
                {t('groups.share_qr')}
              </button>
            </div>
          </section>
        </div>

        {/* Confirm footer — only shown when friends can be added */}
        {addableFriends.length > 0 && (
          <div className="border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          <div className="pb-[max(1rem,env(safe-area-inset-bottom))]" />
        )}
      </div>
    </>
  );
}
