/**
 * repositories/supabase/friendRepository.ts
 *
 * Supabase implementation of IFriendRepository.
 *
 * Fetches all accepted friendships for the current user and resolves
 * the display name of the "other" user via a profile join.
 *
 * Friendship rows are unordered: the current user can be either
 * requester_id or addressee_id. mapFriend handles both cases.
 *
 * Imported by: repositories/index.ts (factory binding)
 */

import { supabase } from '../../lib/supabase/client';
import { type FriendshipWithProfiles, mapFriend } from '../../lib/supabase/mappers';
import type { FriendshipId, UserId } from '../../domain/types';
import type { Friend } from '../../domain/types';
import type { IFriendRepository } from '../types';

export class SupabaseFriendRepository implements IFriendRepository {
  async getAll(): Promise<Friend[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const currentUserId = user.id as UserId;

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        requester:profiles!friendships_requester_id_fkey(display_name),
        addressee:profiles!friendships_addressee_id_fkey(display_name)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) =>
      mapFriend(row as unknown as FriendshipWithProfiles, currentUserId),
    );
  }

  async remove(friendshipId: FriendshipId): Promise<void> {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId as string);

    if (error) throw error;
  }
}
