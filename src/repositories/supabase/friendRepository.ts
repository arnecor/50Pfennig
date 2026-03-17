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

import type { FriendshipId, UserId } from '../../domain/types';
import type { Friend } from '../../domain/types';
import { supabase } from '../../lib/supabase/client';
import { type FriendshipWithProfiles, mapFriend } from '../../lib/supabase/mappers';
import type { EmailSearchResult, FriendInvite, IFriendRepository } from '../types';

export class SupabaseFriendRepository implements IFriendRepository {
  async getAll(): Promise<Friend[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

  // Note: The RPC functions below are defined in migration 0014_friend_invites.sql.
  // After running the migration and `npm run db:types`, the `as any` casts can be
  // removed because the generated types will include these function signatures.

  async createInvite(): Promise<FriendInvite> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types — remove cast after next db:types run
    const { data, error } = await (supabase.rpc as any)('create_friend_invite');

    if (error) throw error;

    return {
      id: data.id,
      token: data.token,
      inviterId: data.inviter_id as UserId,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
    };
  }

  async acceptInvite(token: string): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types — remove cast after next db:types run
    const { error } = await (supabase.rpc as any)('accept_friend_invite', {
      p_token: token,
    });

    if (error) throw error;
  }

  async searchByEmail(email: string): Promise<EmailSearchResult | null> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types — remove cast after next db:types run
    const { data, error } = await (supabase.rpc as any)('search_user_by_email', {
      p_email: email,
    });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const row = data[0];
    return {
      userId: row.user_id as UserId,
      displayName: row.display_name,
      email: row.email,
    };
  }

  async addById(userId: UserId): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types — remove cast after next db:types run
    const { error } = await (supabase.rpc as any)('add_friend_by_id', {
      p_friend_id: userId as string,
    });

    if (error) throw error;
  }
}
