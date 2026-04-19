/**
 * repositories/index.ts
 *
 * Repository factory — the single place where concrete implementations
 * are bound to their interfaces.
 *
 * To swap the sync backend (e.g. Supabase → PowerSync), only this file
 * and the new implementation classes need to change. All feature hooks
 * remain untouched. See ADR-0005.
 *
 * Usage in features:
 *   import { expenseRepository } from '@repositories';
 *   const expenses = await expenseRepository.getByGroupId(groupId);
 */

import { OfflineAwareExpenseRepository } from '../lib/storage/offlineAwareExpenseRepository';
import { OfflineAwareGroupRepository } from '../lib/storage/offlineAwareGroupRepository';
import { SupabaseFriendRepository } from './supabase/friendRepository';
import { SupabaseProfileRepository } from './supabase/profileRepository';
import { SupabaseSettlementRepository } from './supabase/settlementRepository';

// Tier 1 writes (create expense/group, edit/delete own expense) are wrapped
// so they enqueue when offline and delegate to Supabase when online. Tier 2
// repositories (friend, settlement) stay plain — they require the network
// today and are gated at the UI via useRequireOnline.
export const groupRepository = new OfflineAwareGroupRepository();
export const expenseRepository = new OfflineAwareExpenseRepository();
export const settlementRepository = new SupabaseSettlementRepository();
export const friendRepository = new SupabaseFriendRepository();
export const profileRepository = new SupabaseProfileRepository();
