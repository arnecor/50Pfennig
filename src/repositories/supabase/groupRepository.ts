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
import type { CreateGroupInput, IGroupRepository } from '../types';

/** Select string that embeds the profiles join for display names */
const GROUP_SELECT =
  '*, group_members(user_id, group_id, joined_at, profiles(display_name, avatar_url))';

export class SupabaseGroupRepository implements IGroupRepository {
  async getAll(): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const members = (row as typeof row & { group_members: GroupMemberWithProfile[] })
        .group_members;
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
      .select('user_id, group_id, joined_at, profiles(display_name, avatar_url)')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError) throw memberError;
    return mapGroupMember(memberRow as GroupMemberWithProfile);
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
      .select('id, group_id, user_id, event_type, metadata, created_at, profiles(display_name)')
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
}
