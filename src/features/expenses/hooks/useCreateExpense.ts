/**
 * features/expenses/hooks/useCreateExpense.ts
 *
 * TanStack Query mutation hook for creating a new expense.
 *
 * On success, invalidates the expenses query for the group so the list
 * auto-refreshes without a manual reload.
 */

import type { GroupId } from '@domain/types';
import { expenseRepository } from '@repositories';
import type { CreateExpenseInput } from '@repositories/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useCreateExpense = (groupId: GroupId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) => expenseRepository.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
    },
  });
};
