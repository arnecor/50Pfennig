/**
 * repositories/supabase/groupRepository.ts
 *
 * Supabase implementation of IGroupRepository.
 *
 * Imported by: repositories/index.ts (factory binding)
 */

import type {
  Group,
  GroupEvent,
  GroupId,
  GroupInvite,
  GroupMember,
  UserId,
} from '../../domain/types';
import { supabase } from '../../lib/supabase/client';
import {
  mapGroup,
  mapGroupEvent,
  mapGroupInvite,
  mapGroupMember,
} from '../../lib/supabase/mappers';
import type {
  GroupEventRow,
  GroupInviteRow,
  GroupMemberWithProfile,
} from '../../lib/supabase/mappers';
import type { CreateGroupInput, IGroupRepository, UpdateGroupInput } from '../types';

/** Select string that embeds the profiles join for display names */
const GROUP_SELECT =
  '*, group_members(user_id, group_id, joined_at, profiles(display_name, avatar_url, deleted_at))';

export class SupabaseGroupRepository implements IGroupRepository {
  async getAll(): Promise<Group[]> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types — remove cast after next db:types run
    const { data, error } = await (supabase.rpc as any)('get_groups_for_user').select(GROUP_SELECT);

    if (error) throw error;

    // biome-ignore lint/suspicious/noExplicitAny: RPC result shape mirrors groups table — safe cast
    return (data ?? []).map((row: any) => {
      const members = row.group_members as GroupMemberWithProfile[];
      return mapGroup(row, members);
    });
  }

  async getById(id: GroupId): Promise<Group> {
    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;

    const members = (data as typeof data & { group_members: GroupMemberWithProfile[] })
      .group_members;
    return mapGroup(data, members);
  }

  async create(input: CreateGroupInput): Promise<Group> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types — remove cast after next db:types run
    const { data: group, error } = await (supabase.rpc as any)('create_group', {
      p_name: input.name,
      p_member_ids: input.memberIds ?? [],
    });

    if (error) throw error;

    return this.getById((group as { id: string }).id as GroupId);
  }

  async addMember(groupId: GroupId, userId: UserId): Promise<GroupMember> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types
    const { error } = await (supabase.rpc as any)('add_member_with_event', {
      p_group_id: groupId,
      p_user_id: userId,
    });

    if (error) throw error;

    // Fetch the full member row with display name
    const { data: memberRow, error: memberError } = await supabase
      .from('group_members')
      .select('user_id, group_id, joined_at, profiles(display_name, avatar_url, deleted_at)')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError) throw memberError;
    // deleted_at not yet in generated types — remove the unknown cast after next db:types run
    return mapGroupMember(memberRow as unknown as GroupMemberWithProfile);
  }

  async removeMember(groupId: GroupId, userId: UserId): Promise<void> {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async leaveGroup(groupId: GroupId): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types
    const { error } = await (supabase.rpc as any)('leave_group', {
      p_group_id: groupId,
    });

    if (error) throw error;
  }

  async getEvents(groupId: GroupId): Promise<GroupEvent[]> {
    // biome-ignore lint/suspicious/noExplicitAny: group_events table not yet in generated types — remove cast after next db:types run
    const { data, error } = await (supabase as any)
      .from('group_events')
      .select(
        'id, group_id, user_id, event_type, metadata, created_at, profiles(display_name, deleted_at)',
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => mapGroupEvent(row as GroupEventRow));
  }

  async createGroupInvite(groupId: GroupId): Promise<GroupInvite> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types
    const { data, error } = await (supabase.rpc as any)('create_group_invite', {
      p_group_id: groupId,
    });

    if (error) throw error;
    return mapGroupInvite(data as GroupInviteRow);
  }

  async acceptGroupInvite(token: string): Promise<GroupId> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types
    const { data, error } = await (supabase.rpc as any)('accept_group_invite', {
      p_token: token,
    });

    if (error) throw error;
    return data as GroupId;
  }

  async update(id: GroupId, input: UpdateGroupInput): Promise<Group> {
    const updateData: { name?: string; image_url?: string | null } = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;

    const { error } = await supabase.from('groups').update(updateData).eq('id', id);
    if (error) throw error;

    return this.getById(id);
  }

  async archiveGroup(groupId: GroupId): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types — remove cast after next db:types run
    const { error } = await (supabase.rpc as any)('archive_group', {
      p_group_id: groupId,
    });
    if (error) throw error;
  }

  async unarchiveGroup(groupId: GroupId): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types — remove cast after next db:types run
    const { error } = await (supabase.rpc as any)('unarchive_group', {
      p_group_id: groupId,
    });
    if (error) throw error;
  }

  async uploadImage(id: GroupId, file: Blob): Promise<Group> {
    const filePath = `groups/${id}/image`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const imageUrl = `${publicUrl}?t=${Date.now()}`;

    return this.update(id, { imageUrl });
  }
}
