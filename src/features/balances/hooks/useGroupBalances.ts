/**
 * features/balances/hooks/useGroupBalances.ts
 *
 * Derives group balances from the TanStack Query cache.
 * Makes NO network requests of its own.
 *
 * Returns:
 *   balances:             BalanceMap — net balance per member
 *   instructions:         DebtInstruction[] — simplified "who pays whom" list
 *   isLoading:            true if expenses or settlements are still loading
 *   isOfflineUnavailable: true when data is unavailable because the device is
 *                         offline — callers should show an offline message rather
 *                         than incorrect zeroed-out balances
 *
 * Why no fetch: balances are derived state — see ADR-0009.
 */

import { calculateGroupBalances, simplifyDebts } from '@domain/balance';
import type { BalanceMap, DebtInstruction, GroupId } from '@domain/types';
import { useExpenses } from '@features/expenses/hooks/useExpenses';
import { useGroup } from '@features/groups/hooks/useGroups';
import { useSettlements } from '@features/settlements/hooks/useSettlements';
import { useConnectivityStore } from '@lib/connectivity/connectivityStore';
import { useMemo } from 'react';

export function useGroupBalances(groupId: GroupId) {
  const isOnline = useConnectivityStore((s) => s.status === 'online');

  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const {
    data: expenses,
    isLoading: expensesLoading,
    isError: expensesError,
  } = useExpenses(groupId);
  const {
    data: settlements,
    isLoading: settlementsLoading,
    isError: settlementsError,
  } = useSettlements(groupId);

  const isLoading = groupLoading || expensesLoading || settlementsLoading;

  // When either data source errored while offline, we cannot compute a
  // meaningful balance — returning zeros would silently show "all settled".
  const isOfflineUnavailable = !isOnline && (expensesError || settlementsError);

  const balances: BalanceMap = useMemo(() => {
    if (!group || expenses === undefined || settlements === undefined) return new Map();
    return calculateGroupBalances(expenses, settlements, group.members);
  }, [group, expenses, settlements]);

  const instructions: DebtInstruction[] = useMemo(() => simplifyDebts(balances), [balances]);

  return { balances, instructions, isLoading, isOfflineUnavailable, group };
}
