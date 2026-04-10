/**
 * features/expenses/hooks/useCreateExpense.ts
 *
 * TanStack Query mutation hook for creating a new expense.
 *
 * Accepts the full CreateExpenseInput (including groupId which can be null).
 * On success, invalidates the correct query:
 *   - group expense   → ['expenses', groupId]
 *   - friend expense  → ['expenses', 'participant']
 * Both feed into useTotalBalance, so the home-screen totals update automatically.
 */

import { triggerGuestUpgradeReminderFromStore } from '@features/auth/hooks/useGuestUpgradeReminder';
import { expenseRepository } from '@repositories';
import type { CreateExpenseInput } from '@repositories/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useCreateExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) => expenseRepository.create(input),
    onSuccess: (_data, input) => {
      if (input.groupId != null) {
        queryClient.invalidateQueries({ queryKey: ['expenses', input.groupId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['expenses', 'participant'] });
      }
      triggerGuestUpgradeReminderFromStore();
    },
  });
};
