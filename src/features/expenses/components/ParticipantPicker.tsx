/**
 * features/expenses/components/ParticipantPicker.tsx
 *
 * Bottom-sheet overlay for selecting who to split an expense with.
 *
 * UX Design: Tabbed Interface (Option A)
 *   - Two tabs: "Gruppe" and "Freunde" as a segmented control in the header
 *   - Only one tab's content is visible at a time (mutual exclusivity is clear)
 *   - Search filters within the current tab only
 *   - When a group is selected, group members appear below for partial selection
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
  | { type: 'group'; group: Group; selectedMemberIds: UserId[] }
  | { type: 'friends'; userIds: UserId[] };

type Tab = 'group' | 'friends';

type Props = {
  groups: Group[];
  friends: Friend[];
  value: ParticipantSelection | null;
  onChange: (value: ParticipantSelection | null) => void;
  onClose: () => void;
  paidByUserId: UserId;
};

const MIN_GROUP_MEMBERS_SELECTED = 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParticipantPicker({
  groups,
  friends,
  value,
  onChange,
  onClose,
  paidByUserId,
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Determine initial tab based on existing selection
  const initialTab: Tab = value?.type === 'friends' ? 'friends' : 'group';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Local draft state — only committed when user taps "Übernehmen"
  const [draft, setDraft] = useState<ParticipantSelection | null>(value);

  const q = search.trim().toLowerCase();

  // Filter based on active tab only
  const filteredGroups =
    activeTab === 'group'
      ? q
        ? groups.filter((g) => g.name.toLowerCase().includes(q))
        : groups
      : [];

  // Deleted users ("Gelöschter Nutzer") cannot be selected for new expenses.
  const selectableFriends = friends.filter((f) => !f.isDeleted);
  const filteredFriends =
    activeTab === 'friends'
      ? q
        ? selectableFriends.filter((f) => f.displayName.toLowerCase().includes(q))
        : selectableFriends
      : [];

  const selectedGroupId: GroupId | null = draft?.type === 'group' ? draft.group.id : null;

  const selectedFriendIds: UserId[] = draft?.type === 'friends' ? draft.userIds : [];

  // When a group is selected, track which members are selected (default: all)
  const selectedMemberIds: UserId[] = draft?.type === 'group' ? draft.selectedMemberIds : [];

  // Get the currently selected group for displaying members
  const selectedGroup = selectedGroupId
    ? (groups.find((g) => g.id === selectedGroupId) ?? null)
    : null;

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setSearch(''); // Clear search when switching tabs
    // Clear selection when switching tabs (different mode = different selection)
    if (tab === 'group' && draft?.type === 'friends') {
      setDraft(null);
    } else if (tab === 'friends' && draft?.type === 'group') {
      setDraft(null);
    }
  }

  function handleGroupTap(group: Group) {
    if (selectedGroupId === group.id) {
      // Deselect
      setDraft(null);
    } else {
      // Select group with all members selected by default — deleted users are
      // excluded so new expenses never reference "Gelöschter Nutzer".
      const allMemberIds = group.members.filter((m) => !m.isDeleted).map((m) => m.userId);
      setDraft({ type: 'group', group, selectedMemberIds: allMemberIds });
    }
  }

  function handleMemberToggle(memberId: UserId) {
    if (draft?.type !== 'group') return;

    // Prevent toggling the payer (they must always be included)
    if (memberId === paidByUserId) return;

    const current = selectedMemberIds;
    const isCurrentlySelected = current.includes(memberId);

    // Prevent deselecting if it would result in less than minimum members
    if (isCurrentlySelected && current.length <= MIN_GROUP_MEMBERS_SELECTED) {
      return;
    }

    const next = isCurrentlySelected
      ? current.filter((id) => id !== memberId)
      : [...current, memberId];

    setDraft({ type: 'group', group: draft.group, selectedMemberIds: next });
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
        {/* Header with Segmented Control */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          {/* Segmented Control (Tabs) */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => handleTabChange('group')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors
                ${
                  activeTab === 'group'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {t('expenses.form.picker_tab_group')}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('friends')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors
                ${
                  activeTab === 'friends'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {t('expenses.form.picker_tab_friends')}
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label={t('common.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search — filters within current tab only */}
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
          {/* Groups tab content */}
          {activeTab === 'group' && (
            <>
              {/* Groups list */}
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
                          onClick={() => handleGroupTap(group)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted
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

              {/* Group members section — shown when a group is selected */}
              {selectedGroup && (
                <section className="mb-4">
                  <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('expenses.form.picker_members_section')}
                  </p>
                  <div className="flex flex-col gap-1">
                    {selectedGroup.members
                      .filter((member) => !member.isDeleted)
                      .filter((member) => member.displayName.toLowerCase().includes(q))
                      .map((member) => {
                        const isChecked = selectedMemberIds.includes(member.userId);
                        const isPayer = member.userId === paidByUserId;
                        const canDeselect =
                          !isPayer &&
                          (!isChecked || selectedMemberIds.length > MIN_GROUP_MEMBERS_SELECTED);
                        return (
                          <button
                            key={member.userId}
                            type="button"
                            disabled={!canDeselect}
                            onClick={() => handleMemberToggle(member.userId)}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors
                              ${!canDeselect ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'}
                              ${isChecked ? 'text-primary font-medium' : 'text-foreground'}
                            `}
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1 text-left">{member.displayName}</span>
                          </button>
                        );
                      })}
                  </div>
                </section>
              )}

              {/* Empty state for groups */}
              {filteredGroups.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('expenses.form.picker_no_results')}
                </p>
              )}
            </>
          )}

          {/* Friends tab content */}
          {activeTab === 'friends' && (
            <>
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
                          onClick={() => handleFriendToggle(friend.userId)}
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
                </section>
              )}

              {/* Empty state for friends */}
              {filteredFriends.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('expenses.form.picker_no_results')}
                </p>
              )}
            </>
          )}
        </div>

        {/* Confirm button — always visible, pinned to the bottom of the sheet */}
        <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-safe">
          <Button size="lg" className="w-full" onClick={handleConfirm}>
            {t('expenses.form.picker_confirm')}
          </Button>
        </div>
      </div>
    </>
  );
}
