/**
 * features/expenses/components/ParticipantPicker.tsx
 *
 * Bottom-sheet overlay for selecting who to split an expense with.
 *
 * Rules:
 *   - Either ONE group OR one-or-more friends can be selected — never both.
 *   - Groups are tap-to-select (radio-like). Tapping a selected group deselects.
 *   - Friends are checkbox-select (multi). Selecting any friend deselects the group.
 *   - Search bar filters both sections independently by name.
 *   - "Übernehmen" confirms the selection and closes.
 *
 * Uses a custom fixed overlay (no Dialog — not installed in this project).
 */

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import type { Friend, Group, GroupId, UserId } from '@domain/types';
import { CheckSquare, Search, Square, Users, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParticipantSelection =
  | { type: 'group'; group: Group }
  | { type: 'friends'; userIds: UserId[] };

type Props = {
  groups: Group[];
  friends: Friend[];
  value: ParticipantSelection | null;
  onChange: (value: ParticipantSelection | null) => void;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParticipantPicker({ groups, friends, value, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Local draft state — only committed when user taps "Übernehmen"
  const [draft, setDraft] = useState<ParticipantSelection | null>(value);

  const q = search.trim().toLowerCase();

  const filteredGroups = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;

  const filteredFriends = q
    ? friends.filter((f) => f.displayName.toLowerCase().includes(q))
    : friends;

  const selectedGroupId: GroupId | null = draft?.type === 'group' ? draft.group.id : null;

  const selectedFriendIds: UserId[] = draft?.type === 'friends' ? draft.userIds : [];

  const groupsDisabled = draft?.type === 'friends' && draft.userIds.length > 0;
  const friendsDisabled = draft?.type === 'group';

  function handleGroupTap(group: Group) {
    if (selectedGroupId === group.id) {
      // Deselect
      setDraft(null);
    } else {
      setDraft({ type: 'group', group });
    }
  }

  function handleFriendToggle(userId: UserId) {
    const current = selectedFriendIds;
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];

    setDraft(next.length === 0 ? null : { type: 'friends', userIds: next });
  }

  function handleConfirm() {
    onChange(draft);
    onClose();
  }

  return (
    <>
      {/* Backdrop — above the nav bar (z-50) */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is aria-hidden, keyboard users interact via the sheet's close button */}
      <div className="fixed inset-0 z-[55] bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Sheet — sits above backdrop and nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl bg-background shadow-xl h-[70dvh] max-h-[70dvh]">
        {/* Handle + Header */}
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-base font-semibold">{t('expenses.form.picker_title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label={t('common.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative px-4 pt-3 pb-2">
          <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('expenses.form.picker_search')}
            className="pl-9"
          />
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Groups section */}
          {filteredGroups.length > 0 && (
            <section className="mb-4">
              <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('expenses.form.picker_groups_section')}
              </p>
              <div className="flex flex-col gap-1">
                {filteredGroups.map((group) => {
                  const isSelected = selectedGroupId === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      disabled={groupsDisabled}
                      onClick={() => handleGroupTap(group)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors
                        ${groupsDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'}
                        ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}
                      `}
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{group.name}</span>
                      {isSelected && <CheckSquare className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Friends section */}
          {filteredFriends.length > 0 && (
            <section className="mb-4">
              <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('expenses.form.picker_friends_section')}
              </p>
              <div className="flex flex-col gap-1">
                {filteredFriends.map((friend) => {
                  const isChecked = selectedFriendIds.includes(friend.userId);
                  return (
                    <button
                      key={friend.userId}
                      type="button"
                      disabled={friendsDisabled}
                      onClick={() => handleFriendToggle(friend.userId)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors
                        ${friendsDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'}
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
            </section>
          )}

          {/* Empty state */}
          {filteredGroups.length === 0 && filteredFriends.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('expenses.form.picker_no_results')}
            </p>
          )}
        </div>

        {/* Confirm button — always visible, pinned to the bottom of the sheet */}
        <div
          className="shrink-0 border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Button size="lg" className="w-full" onClick={handleConfirm}>
            {t('expenses.form.picker_confirm')}
          </Button>
        </div>
      </div>
    </>
  );
}
