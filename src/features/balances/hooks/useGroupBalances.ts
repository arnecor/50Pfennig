/**
 * features/balances/hooks/useGroupBalances.ts
 *
 * Derives group balances from the TanStack Query cache.
 * Makes NO network requests of its own.
 *
 * Returns:
 *   balances:     BalanceMap — net balance per member
 *   instructions: DebtInstruction[] — simplified "who pays whom" list
 *   isLoading:    true if expenses or settlements are still loading
 *
 * Implementation:
 *   const { data: expenses }    = useExpenses(groupId);
 *   const { data: settlements } = useSettlements(groupId);
 *   const { data: group }       = useGroup(groupId);
 *   const balances = useMemo(
 *     () => calculateGroupBalances(expenses, settlements, group.members),
 *     [expenses, settlements, group]
 *   );
 *
 * Why no fetch: balances are derived state — see ADR-0009.
 */

// TODO: Implement

export {};
