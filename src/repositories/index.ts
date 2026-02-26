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

import { SupabaseGroupRepository }      from './supabase/groupRepository';
import { SupabaseExpenseRepository }    from './supabase/expenseRepository';
import { SupabaseSettlementRepository } from './supabase/settlementRepository';

export const groupRepository      = new SupabaseGroupRepository();
export const expenseRepository    = new SupabaseExpenseRepository();
export const settlementRepository = new SupabaseSettlementRepository();
