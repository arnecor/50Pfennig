/**
 * features/settlements/hooks/useSettlements.ts
 *
 * TanStack Query hooks for settlement data.
 *
 * Exports:
 *   useSettlements(groupId)  → all settlements for a group
 */

import type { GroupId } from '@domain/types';
import { useQuery } from '@tanstack/react-query';
import { settlementsQueryOptions } from '../settlementQueries';

export const useSettlements = (groupId: GroupId) => useQuery(settlementsQueryOptions(groupId));
