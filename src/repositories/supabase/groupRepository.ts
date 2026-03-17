/**
 * repositories/supabase/groupRepository.ts
 *
 * Supabase implementation of IGroupRepository.
 *
 * Imported by: repositories/index.ts (factory binding)
 */

import type { Group, GroupId, GroupMember, UserId } from '../../domain/types';
import { supabase } from '../../lib/supabase/client';
import { mapGroup, mapGroupMember } from '../../lib/supabase/mappers';
import type { GroupMemberWithProfile } from '../../lib/supabase/mappers';
import type { CreateGroupInput, IGroupRepository } from '../types';

/** Select string that embeds the profiles join for display names */
const GROUP_SELECT = '*, group_members(user_id, group_id, joined_at, profiles(display_name))';

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
    const { data, error } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: userId })
      .select('user_id, group_id, joined_at, profiles(display_name)')
      .single();

    if (error) throw error;
    return mapGroupMember(data as GroupMemberWithProfile);
  }

  async removeMember(groupId: GroupId, userId: UserId): Promise<void> {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;
  }
}
