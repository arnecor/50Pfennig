/**
 * pages/GroupSettingsPage.tsx
 *
 * Route: /groups/:groupId/settings
 *
 * Shows:
 *   - Group image hero (editable, with predefined icons or custom photo)
 *   - Editable group name
 *   - Share section (link / QR placeholders)
 *   - Member list with per-member balance
 *   - "Gruppe verlassen" button (disabled when user's balance ≠ 0)
 *
 * Anonymous users are gated via GuestUpgradeDialog when they try to edit.
 */

import { GroupAvatar } from '@components/shared/GroupAvatar';
import { PageHeader } from '@components/shared/PageHeader';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { calculateGroupBalances } from '@domain/balance';
import { buildIconImageUrl } from '@domain/groupImage';
import { formatMoney, isPositive, isZero } from '@domain/money';
import { type GroupId, type UserId, ZERO } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import GuestUpgradeDialog from '@features/auth/components/GuestUpgradeDialog';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useFriends } from '@features/friends/hooks/useFriends';
import AddMemberOverlay from '@features/groups/components/AddMemberOverlay';
import GroupImagePicker from '@features/groups/components/GroupImagePicker';
import { useAddGroupMembers } from '@features/groups/hooks/useAddGroupMembers';
import { useArchiveGroup } from '@features/groups/hooks/useArchiveGroup';
import { useGroup } from '@features/groups/hooks/useGroups';
import { useLeaveGroup } from '@features/groups/hooks/useLeaveGroup';
import { useUnarchiveGroup } from '@features/groups/hooks/useUnarchiveGroup';
import { useUpdateGroup } from '@features/groups/hooks/useUpdateGroup';
import { useUploadGroupImage } from '@features/groups/hooks/useUploadGroupImage';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { cn } from '@lib/utils';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  Archive,
  ArchiveRestore,
  Check,
  Loader2,
  LogOut,
  Pencil,
  Share2,
  UserPlus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function GroupSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams({ strict: false }) as { groupId: string };

  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;
  const isAnonymous = useAuthStore((s) => s.session?.user.is_anonymous ?? false);

  const { data: group, isLoading: groupLoading } = useGroup(groupId as GroupId);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(groupId as GroupId);
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements(
    groupId as GroupId,
  );
  const { data: friends = [] } = useFriends();

  const updateGroup = useUpdateGroup();
  const uploadGroupImage = useUploadGroupImage();
  const addMembers = useAddGroupMembers();
  const leaveGroup = useLeaveGroup();
  const archiveGroup = useArchiveGroup();
  const unarchiveGroup = useUnarchiveGroup();

  const [showMemberOverlay, setShowMemberOverlay] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showAnonGate, setShowAnonGate] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  // Image upload error
  const [imageError, setImageError] = useState<string | null>(null);

  const isLoading = groupLoading || expensesLoading || settlementsLoading;

  const balanceMap = useMemo(() => {
    if (!group || !expenses) return new Map();
    return calculateGroupBalances(expenses, settlements, group.members);
  }, [expenses, settlements, group]);

  const myBalance = useMemo(() => {
    if (!currentUserId) return ZERO;
    return balanceMap.get(currentUserId) ?? ZERO;
  }, [balanceMap, currentUserId]);

  const canLeave = isZero(myBalance) && !isLoading;

  function handleBack() {
    navigate({ to: '/groups/$groupId', params: { groupId } });
  }

  function handleAddMembers(userIds: UserId[]) {
    if (!group) return;
    addMembers.mutate(
      { groupId: group.id, userIds },
      { onSuccess: () => setShowMemberOverlay(false) },
    );
  }

  function handleLeave() {
    if (!window.confirm(t('groups.leave_group_confirm'))) return;
    leaveGroup.mutate(groupId as GroupId, {
      onSuccess: () => navigate({ to: '/groups' }),
      onError: () => window.alert(t('common.error_generic')),
    });
  }

  // --- Edit button guard (anonymous users) ---
  function requireAuth(action: () => void) {
    if (isAnonymous) {
      setShowAnonGate(true);
    } else {
      action();
    }
  }

  // --- Archive / reactivate ---
  function handleArchive() {
    requireAuth(() => setShowArchiveDialog(true));
  }

  function handleConfirmArchive() {
    if (!group) return;
    archiveGroup.mutate(group.id, {
      onSuccess: () => {
        setShowArchiveDialog(false);
        navigate({ to: '/groups' });
      },
    });
  }

  function handleReactivate() {
    if (!group) return;
    unarchiveGroup.mutate(group.id, {
      onSuccess: () => navigate({ to: '/groups/$groupId', params: { groupId } }),
    });
  }

  const isArchived = group?.isArchived ?? false;

  // --- Image picker callbacks ---
  function handlePickIcon(key: string) {
    if (!group) return;
    setImageError(null);
    updateGroup.mutate({ groupId: group.id, input: { imageUrl: buildIconImageUrl(key) } });
  }

  function handlePickFile(file: File) {
    if (!group) return;
    setImageError(null);
    uploadGroupImage.mutate(
      { groupId: group.id, file },
      { onError: () => setImageError(t('groups.image_upload_error')) },
    );
  }

  function handleResetImage() {
    if (!group) return;
    setImageError(null);
    updateGroup.mutate({ groupId: group.id, input: { imageUrl: null } });
  }

  // --- Name editing callbacks ---
  function startEditName() {
    setNameValue(group?.name ?? '');
    setNameError(null);
    setIsEditingName(true);
  }

  function cancelEditName() {
    setIsEditingName(false);
    setNameError(null);
  }

  function submitName() {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameError(t('groups.name_error_required'));
      return;
    }
    if (!group) return;
    updateGroup.mutate(
      { groupId: group.id, input: { name: trimmed } },
      {
        onSuccess: () => setIsEditingName(false),
        onError: () => setNameError(t('common.error_generic')),
      },
    );
  }

  const isImageLoading = uploadGroupImage.isPending || updateGroup.isPending;

  return (
    <div className="min-h-full pb-24">
      <PageHeader
        title={groupLoading ? '…' : (group?.name ?? '')}
        subtitle={t('groups.settings')}
        onBack={handleBack}
      />

      <div className="px-5 space-y-5">
        {/* --- Group image hero + name --- */}
        <div className="flex flex-col items-center gap-3 pt-2 pb-1">
          {/* Avatar — edit button hidden for archived groups */}
          <div className="relative">
            {isImageLoading ? (
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <GroupAvatar
                imageUrl={group?.imageUrl}
                groupName={group?.name ?? ''}
                size="xl"
                className="rounded-2xl"
              />
            )}
            {!isArchived && (
              <button
                type="button"
                onClick={() => requireAuth(() => setShowImagePicker(true))}
                disabled={isImageLoading}
                className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-background"
                aria-label={t('groups.edit_picture')}
              >
                <Pencil className="h-3 w-3 text-primary-foreground" />
              </button>
            )}
          </div>

          {imageError && <p className="text-destructive text-xs text-center">{imageError}</p>}

          {/* Group name — read-only display for archived groups */}
          {isArchived ? (
            <span className="text-base font-semibold text-muted-foreground max-w-[200px] truncate py-1">
              {groupLoading ? '…' : (group?.name ?? '')}
            </span>
          ) : isEditingName ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <Input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitName();
                  if (e.key === 'Escape') cancelEditName();
                }}
                maxLength={100}
                placeholder={t('groups.edit_name_placeholder')}
                className="h-9 text-sm text-center"
              />
              <button
                type="button"
                onClick={submitName}
                disabled={updateGroup.isPending}
                aria-label={t('common.save')}
                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                {updateGroup.isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={cancelEditName}
                disabled={updateGroup.isPending}
                aria-label={t('common.cancel')}
                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => requireAuth(startEditName)}
              className="relative inline-flex items-center justify-center py-1 pl-8 pr-8 rounded-lg hover:bg-muted/50 active:bg-muted/80 transition-colors"
              aria-label={t('groups.edit_name')}
            >
              <span className="text-base font-semibold text-foreground max-w-[200px] truncate">
                {groupLoading ? '…' : (group?.name ?? '')}
              </span>
              <Pencil className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-40" />
            </button>
          )}
          {nameError && <p className="text-destructive text-xs">{nameError}</p>}
        </div>

        {/* Share section — hidden for archived groups */}
        {!isArchived && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {t('groups.share_group')}
            </p>
            <button
              type="button"
              onClick={() => setShowMemberOverlay(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors hover:bg-muted active:opacity-80"
            >
              <Share2 className="h-4 w-4" />
              {t('groups.share_invite_link')}
            </button>
          </div>
        )}

        {/* Members section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('groups.members')}
              {group ? ` (${group.members.length})` : ''}
            </p>
            {!isArchived && (
              <button
                type="button"
                onClick={() => setShowMemberOverlay(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t('groups.add_members')}
              </button>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden px-4">
            {isLoading &&
              [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                >
                  <div className="flex-1 h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
              ))}

            {!isLoading &&
              group?.members.map((member) => {
                const balance = balanceMap.get(member.userId) ?? ZERO;
                const settled = isZero(balance);
                const positive = isPositive(balance);
                const isMe = (member.userId as string) === (currentUserId as string);

                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {isMe ? t('common.you') : member.displayName}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            ({member.displayName})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {settled ? (
                        <p className="text-sm text-muted-foreground">{t('groups.balanced')}</p>
                      ) : (
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            positive ? 'text-owed-to-you' : 'text-you-owe',
                          )}
                        >
                          {positive ? '+' : ''}
                          {formatMoney(balance)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Archive / Reactivate / Leave section */}
        <div className="space-y-3">
          {isArchived ? (
            /* Archived group — show reactivate hint + button, hide leave */
            <>
              <p className="text-xs text-muted-foreground text-center px-2">
                {t('groups.archived_settings_hint')}
              </p>
              <Button
                variant="default"
                className="w-full"
                onClick={handleReactivate}
                disabled={unarchiveGroup.isPending}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" />
                {unarchiveGroup.isPending ? t('common.loading') : t('groups.reactivate')}
              </Button>
            </>
          ) : (
            /* Active group — archive button + leave button */
            <>
              <Button variant="outline" className="w-full" onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" />
                {t('groups.archive_action')}
              </Button>

              {!canLeave && !isLoading && !isZero(myBalance) && (
                <p className="text-xs text-muted-foreground text-center px-2">
                  {t('groups.leave_blocked_hint')}
                </p>
              )}
              <Button
                variant="destructive"
                className="w-full"
                disabled={!canLeave || leaveGroup.isPending}
                onClick={handleLeave}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {leaveGroup.isPending ? t('common.loading') : t('groups.leave_group')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Overlays */}
      {showMemberOverlay && group && (
        <AddMemberOverlay
          group={group}
          friends={friends}
          onAddMembers={handleAddMembers}
          isPending={addMembers.isPending}
          onClose={() => setShowMemberOverlay(false)}
        />
      )}

      {showImagePicker && (
        <GroupImagePicker
          onPickIcon={handlePickIcon}
          onPickFile={handlePickFile}
          onReset={handleResetImage}
          onClose={() => setShowImagePicker(false)}
        />
      )}

      {showAnonGate && (
        <GuestUpgradeDialog variant="gate" onDismiss={() => setShowAnonGate(false)} />
      )}

      {/* Archive confirmation dialog */}
      <Dialog
        open={showArchiveDialog}
        onOpenChange={(open) => {
          if (!open) setShowArchiveDialog(false);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('groups.archive_confirm_title')}</DialogTitle>
            <DialogDescription>{t('groups.archive_confirm_body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
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
    </div>
  );
}
