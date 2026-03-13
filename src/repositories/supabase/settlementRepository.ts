/**
 * repositories/supabase/settlementRepository.ts
 *
 * Supabase implementation of ISettlementRepository.
 *
 * Single settlements are a simple INSERT. Batch settlements use the
 * create_settlement_batch RPC for atomicity (ADR-0012).
 *
 * Imported by: repositories/index.ts (factory binding)
 */

import type { GroupId, Settlement, SettlementId, UserId } from '../../domain/types';
import { supabase } from '../../lib/supabase/client';
import { mapSettlement } from '../../lib/supabase/mappers';
import type { Json } from '../../lib/supabase/types.gen';
import type { CreateSettlementBatchInput, CreateSettlementInput, ISettlementRepository } from '../types';

export class SupabaseSettlementRepository implements ISettlementRepository {
  async getById(id: SettlementId): Promise<Settlement> {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return mapSettlement(data);
  }

  async getByGroupId(groupId: GroupId): Promise<Settlement[]> {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapSettlement);
  }

  async getByParticipant(): Promise<Settlement[]> {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .is('group_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapSettlement);
  }

  async getSharedWithUser(userId: UserId): Promise<Settlement[]> {
    // Fetch all settlements where both users are involved (any group_id).
    // RLS already limits to settlements the current user can see.
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapSettlement);
  }

  async create(input: CreateSettlementInput): Promise<Settlement> {
    const { data, error } = await supabase
      .from('settlements')
      .insert({
        group_id:     input.groupId,
        from_user_id: input.fromUserId,
        to_user_id:   input.toUserId,
        amount:       input.amount,
        note:         input.note ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapSettlement(data);
  }

  async createBatch(input: CreateSettlementBatchInput): Promise<Settlement[]> {
    const allocations = input.allocations.map(a => ({
      group_id:     a.groupId,
      from_user_id: a.fromUserId,
      to_user_id:   a.toUserId,
      amount:       a.amount,
    }));

    const { data: batchId, error } = await supabase.rpc('create_settlement_batch', {
      p_from_user_id: input.fromUserId,
      p_to_user_id:   input.toUserId,
      p_note:         input.note ?? null,
      p_allocations:  allocations as unknown as Json,
    });

    if (error) throw error;

    // Fetch the created records
    const { data, error: fetchError } = await supabase
      .from('settlements')
      .select('*')
      .eq('batch_id', batchId as string)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    return (data ?? []).map(mapSettlement);
  }

  async delete(id: SettlementId): Promise<void> {
    const { error } = await supabase
      .from('settlements')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteBatch(batchId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_settlement_batch', {
      p_batch_id: batchId,
    });

    if (error) throw error;
  }
}
