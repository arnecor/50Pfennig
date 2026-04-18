/**
 * features/expenses/hooks/useDeleteExpense.ts
 *
 * TanStack Query mutation hook for deleting an expense.
 *
 * Only the expense creator can delete (enforced by RLS).
 * expense_splits are cascade-deleted by the database automatically.
 *
 * Uses optimistic removal: the expense disappears from the list immediately
 * (onMutate) and is restored on error. This keeps the UI responsive offline
 * and prevents a flash of "expense still there" while the network call runs.
 */

import type { Expense } from '@domain/types';
import { expenseRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expense: Expense) => expenseRepository.delete(expense.id),
    onMutate: async (expense) => {
      const listKey =
        expense.groupId != null
          ? (['expenses', expense.groupId] as const)
          : (['expenses', 'participant'] as const);

      // Cancel in-flight fetches so they don't overwrite the optimistic removal.
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousList = queryClient.getQueryData<Expense[]>(listKey);

      queryClient.setQueryData<Expense[]>(listKey, (old) =>
        old ? old.filter((e) => e.id !== expense.id) : [],
      );

      return { previousList, listKey };
    },
    onError: (_err, _expense, context) => {
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(context.listKey, context.previousList);
      }
    },
    onSuccess: (_data, expense) => {
      const listKey =
        expense.groupId != null
          ? (['expenses', expense.groupId] as const)
          : (['expenses', 'participant'] as const);
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'shared'] });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'detail', expense.id] });
    },
  });
};
