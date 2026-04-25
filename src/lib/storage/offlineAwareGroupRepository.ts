/**
 * lib/storage/offlineAwareGroupRepository.ts
 *
 * Wrapper around SupabaseGroupRepository that enqueues create() when offline.
 *
 * Only create() is Tier 1 for offline. All other writes (addMember,
 * removeMember, archive, uploadImage, invites) require the network today
 * and stay in Tier 2 — see plan "Scope — Which Actions Work Offline".
 * They will throw if called offline; gated by useRequireOnline on the UI side.
 */

import type { Group, GroupEvent, GroupId, GroupInvite, GroupMember, UserId } from '@domain/types';
import { SupabaseGroupRepository } from '@repositories/supabase/groupRepository';
import type { CreateGroupInput, IGroupRepository, UpdateGroupInput } from '@repositories/types';

import { useConnectivityStore } from '@lib/connectivity/connectivityStore';
import { isOfflineModeEnabled } from '@lib/featureFlags';
import { generateTempId } from '@lib/ids';

import { useAuthStore } from '@features/auth/authStore';

import { useOfflineQueue } from './offlineQueue';

/**
 * Returns true for fetch-level network failures (no TCP connection, DNS failure,
 * request aborted). Returns false for HTTP-level errors (4xx, 5xx) which carry
 * meaningful server responses and should not be silently queued.
 */
function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    /failed to fetch|network request failed|load failed/i.test((err as TypeError).message)
  );
}

function currentUserId(): UserId {
  const session = useAuthStore.getState().session;
  if (!session) {
    throw new Error('Cannot create group offline without an authenticated session');
  }
  return session.user.id as UserId;
}

function currentUserDisplayName(): string {
  const session = useAuthStore.getState().session;
  const meta = session?.user.user_metadata as { display_name?: string; name?: string } | undefined;
  return meta?.display_name ?? meta?.name ?? session?.user.email ?? '…';
}

export class OfflineAwareGroupRepository implements IGroupRepository {
  private readonly inner = new SupabaseGroupRepository();

  private shouldQueue(): boolean {
    if (!isOfflineModeEnabled()) return false;
    return useConnectivityStore.getState().status !== 'online';
  }

  /**
   * Marks the OS as disconnected so subsequent shouldQueue() calls return true,
   * then queues the write. Called when a live Supabase call fails with a network
   * error mid-session (soft-offline: OS still reports connected but packets lost).
   */
  private markOffline(): void {
    useConnectivityStore.getState().setOsConnected(false);
  }

  getAll(): Promise<Group[]> {
    return this.inner.getAll();
  }
  getById(id: GroupId): Promise<Group> {
    return this.inner.getById(id);
  }

  async create(input: CreateGroupInput): Promise<Group> {
    if (this.shouldQueue()) return this.createOffline(input);

    try {
      return await this.inner.create(input);
    } catch (err) {
      if (isNetworkError(err) && isOfflineModeEnabled()) {
        this.markOffline();
        return this.createOffline(input);
      }
      throw err;
    }
  }

  private createOffline(input: CreateGroupInput): Group {
    const createdBy = currentUserId();
    const tempId = generateTempId() as GroupId;
    const now = new Date();

    useOfflineQueue.getState().enqueue({
      id: tempId as string,
      type: 'CREATE_GROUP',
      payload: {
        name: input.name,
        memberIds: (input.memberIds ?? []) as string[],
      },
    });

    // Optimistic Group with just the creator as a member. Any extra members
    // will appear after the replay refetch — they require server-side
    // friendship checks, which we can't safely do offline.
    return {
      id: tempId,
      name: input.name,
      createdBy,
      createdAt: now,
      members: [
        {
          userId: createdBy,
          groupId: tempId,
          displayName: currentUserDisplayName(),
          joinedAt: now,
          isDeleted: false,
        },
      ],
      isArchived: false,
    };
  }

  // ---- Tier 2 operations — require network today ----
  addMember(groupId: GroupId, userId: UserId): Promise<GroupMember> {
    return this.inner.addMember(groupId, userId);
  }
  removeMember(groupId: GroupId, userId: UserId): Promise<void> {
    return this.inner.removeMember(groupId, userId);
  }
  leaveGroup(groupId: GroupId): Promise<void> {
    return this.inner.leaveGroup(groupId);
  }
  getEvents(groupId: GroupId): Promise<GroupEvent[]> {
    return this.inner.getEvents(groupId);
  }
  createGroupInvite(groupId: GroupId): Promise<GroupInvite> {
    return this.inner.createGroupInvite(groupId);
  }
  acceptGroupInvite(token: string): Promise<GroupId> {
    return this.inner.acceptGroupInvite(token);
  }
  update(id: GroupId, input: UpdateGroupInput): Promise<Group> {
    return this.inner.update(id, input);
  }
  archiveGroup(groupId: GroupId): Promise<void> {
    return this.inner.archiveGroup(groupId);
  }
  unarchiveGroup(groupId: GroupId): Promise<void> {
    return this.inner.unarchiveGroup(groupId);
  }
  uploadImage(id: GroupId, file: Blob): Promise<Group> {
    return this.inner.uploadImage(id, file);
  }
}
