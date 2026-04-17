/**
 * features/groups/components/GroupList.tsx
 *
 * Renders the list of groups the current user belongs to.
 *
 * Active groups are shown first (sorted by the server — groups with expenses
 * before groups without). Each active card is wrapped in SwipeableRow to
 * reveal an "Archivieren" action on left swipe.
 *
 * Archived groups are shown at the bottom in a collapsible section.
 */

import EmptyState from '@components/shared/EmptyState';
import { SwipeableRow } from '@components/shared/SwipeableRow';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import type { GroupId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import GuestUpgradeDialog from '@features/auth/components/GuestUpgradeDialog';
import { Archive, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useArchiveGroup } from '../hooks/useArchiveGroup';
import { useGroups } from '../hooks/useGroups';
import GroupCard from './GroupCard';

function GroupCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
      <div className="w-12 h-12 rounded-xl bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-16 animate-pulse rounded bg-muted shrink-0" />
    </div>
  );
}

/** Red swipe action button revealed behind a group card */
function ArchiveSwipeAction({ onArchive }: { onArchive: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onArchive}
      className="flex flex-col items-center justify-center w-full bg-destructive text-destructive-foreground gap-1 rounded-xl"
      aria-label={t('groups.archive_action')}
    >
      <Archive className="w-5 h-5" />
      <span className="text-xs font-medium">{t('groups.archive_action')}</span>
    </button>
  );
}

type Props = {
  onCreateGroup?: () => void;
};

export default function GroupList({ onCreateGroup }: Props) {
  const { t } = useTranslation();
  const { data: groups, isLoading } = useGroups();
  const archiveGroup = useArchiveGroup();
  const isAnonymous = useAuthStore((s) => s.session?.user.is_anonymous ?? false);

  const [pendingArchiveId, setPendingArchiveId] = useState<GroupId | null>(null);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [showAnonGate, setShowAnonGate] = useState(false);

  const activeGroups = (groups ?? []).filter((g) => !g.isArchived);
  const archivedGroups = (groups ?? []).filter((g) => g.isArchived);

  function handleSwipeAction(groupId: GroupId) {
    if (isAnonymous) {
      setShowAnonGate(true);
    } else {
      setPendingArchiveId(groupId);
    }
  }

  function handleConfirmArchive() {
    if (!pendingArchiveId) return;
    archiveGroup.mutate(pendingArchiveId, {
      onSuccess: () => setPendingArchiveId(null),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <EmptyState
        title={t('groups.empty_title')}
        description={t('groups.empty_description')}
        action={<Button onClick={onCreateGroup}>{t('groups.create')}</Button>}
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Active groups */}
        {activeGroups.map((group) => (
          <SwipeableRow
            key={group.id}
            actionWidth={88}
            action={<ArchiveSwipeAction onArchive={() => handleSwipeAction(group.id)} />}
          >
            <GroupCard group={group} />
          </SwipeableRow>
        ))}

        {/* Empty active list but archived groups exist */}
        {activeGroups.length === 0 && archivedGroups.length > 0 && (
          <EmptyState
            title={t('groups.empty_title')}
            description={t('groups.empty_description')}
            action={<Button onClick={onCreateGroup}>{t('groups.create')}</Button>}
          />
        )}

        {/* Archived section */}
        {archivedGroups.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setArchivedExpanded((v) => !v)}
              className="flex items-center gap-2 w-full px-1 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>
                {t('groups.archived_section_title')} ({archivedGroups.length})
              </span>
              {archivedExpanded ? (
                <ChevronUp className="w-4 h-4 ml-auto" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-auto" />
              )}
            </button>

            {archivedExpanded && (
              <div className="space-y-3 mt-1">
                {archivedGroups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archive confirmation dialog */}
      <Dialog
        open={pendingArchiveId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingArchiveId(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('groups.archive_confirm_title')}</DialogTitle>
            <DialogDescription>{t('groups.archive_confirm_body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingArchiveId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmArchive}
              disabled={archiveGroup.isPending}
            >
              {archiveGroup.isPending ? t('common.loading') : t('groups.archive_action')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anonymous user gate */}
      {showAnonGate && (
        <GuestUpgradeDialog variant="gate" onDismiss={() => setShowAnonGate(false)} />
      )}
    </>
  );
}
