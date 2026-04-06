/**
 * features/expenses/hooks/useDeleteExpense.ts
 *
 * TanStack Query mutation hook for deleting an expense.
 *
 * Only the expense creator can delete (enforced by RLS).
 * expense_splits are cascade-deleted by the database automatically.
 * On success, invalidates the correct query:
 *   - group expense   → ['expenses', groupId]
 *   - friend expense  → ['expenses', 'participant']
 */

import type { Expense } from '@domain/types';
import { expenseRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expense: Expense) => expenseRepository.delete(expense.id),
    onSuccess: (_data, expense) => {
      if (expense.groupId != null) {
        queryClient.invalidateQueries({ queryKey: ['expenses', expense.groupId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['expenses', 'participant'] });
      }
      queryClient.invalidateQueries({ queryKey: ['expenses', 'shared'] });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'detail', expense.id] });
    },
  });
};
