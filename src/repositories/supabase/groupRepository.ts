/**
 * repositories/supabase/groupRepository.ts
 *
 * Supabase implementation of IGroupRepository.
 *
 * Imported by: repositories/index.ts (factory binding)
 */

import { supabase } from '../../lib/supabase/client';
import { mapGroup, mapGroupMember } from '../../lib/supabase/mappers';
import type { IGroupRepository, CreateGroupInput } from '../types';
import type { Group, GroupId, GroupMember, UserId } from '../../domain/types';

export class SupabaseGroupRepository implements IGroupRepository {
  async getAll(): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('*, group_members(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const members = (row as typeof row & { group_members: unknown[] }).group_members;
      return mapGroup(row, members as never[]);
    });
  }

  async getById(id: GroupId): Promise<Group> {
    const { data, error } = await supabase
      .from('groups')
      .select('*, group_members(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    const members = (data as typeof data & { group_members: unknown[] }).group_members;
    return mapGroup(data, members as never[]);
  }

  async create(input: CreateGroupInput): Promise<Group> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw authError ?? new Error('Not authenticated');

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ name: input.name, created_by: user.id })
      .select()
      .single();

    if (groupError) throw groupError;

    const displayName: string =
      (user.user_metadata?.['display_name'] as string | undefined) ??
      user.email ??
      user.id;

    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id, display_name: displayName })
      .select()
      .single();

    if (memberError) throw memberError;

    return mapGroup(group, [member]);
  }

  async addMember(groupId: GroupId, userId: UserId, displayName: string): Promise<GroupMember> {
    const { data, error } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: userId, display_name: displayName })
      .select()
      .single();

    if (error) throw error;
    return mapGroupMember(data);
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
