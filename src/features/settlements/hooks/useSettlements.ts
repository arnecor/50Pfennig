/**
 * features/settlements/hooks/useSettlements.ts
 *
 * TanStack Query hooks for settlement data.
 *
 * Exports:
 *   useSettlements(groupId)  → all settlements for a group
 */

import { useQuery } from '@tanstack/react-query';
import { settlementsQueryOptions } from '../settlementQueries';
import type { GroupId } from '@domain/types';

export const useSettlements = (groupId: GroupId) =>
  useQuery(settlementsQueryOptions(groupId));
