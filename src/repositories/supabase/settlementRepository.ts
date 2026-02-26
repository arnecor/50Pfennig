/**
 * repositories/supabase/settlementRepository.ts
 *
 * Supabase implementation of ISettlementRepository.
 *
 * Settlements are a single-table operation — no related splits or RPCs needed.
 *
 * Imported by: repositories/index.ts (factory binding)
 */

import { supabase } from '../../lib/supabase/client';
import { mapSettlement } from '../../lib/supabase/mappers';
import type { ISettlementRepository, CreateSettlementInput } from '../types';
import type { Settlement, SettlementId, GroupId } from '../../domain/types';

export class SupabaseSettlementRepository implements ISettlementRepository {
  async getByGroupId(groupId: GroupId): Promise<Settlement[]> {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)
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

  async delete(id: SettlementId): Promise<void> {
    const { error } = await supabase
      .from('settlements')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
