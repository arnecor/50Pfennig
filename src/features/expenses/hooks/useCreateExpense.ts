/**
 * features/expenses/hooks/useCreateExpense.ts
 *
 * TanStack Query mutation hook for creating a new expense.
 *
 * Accepts the full CreateExpenseInput (including groupId which can be null).
 * On success, seeds the list and detail caches before invalidating so the
 * expense is visible immediately — especially important offline where
 * invalidation triggers a no-op refetch that returns the cached list without
 * the new item.
 *
 * Query keys:
 *   - group expense   → ['expenses', groupId]
 *   - friend expense  → ['expenses', 'participant']
 *   - detail          → ['expenses', 'detail', id]
 * Both list keys feed into useTotalBalance, so home-screen totals update automatically.
 */

import type { Expense } from '@domain/types';
import { triggerGuestUpgradeReminderFromStore } from '@features/auth/hooks/useGuestUpgradeReminder';
import { expenseRepository } from '@repositories';
import type { CreateExpenseInput } from '@repositories/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useCreateExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) => expenseRepository.create(input),
    onSuccess: (newExpense: Expense, input) => {
      const listKey =
        input.groupId != null
          ? (['expenses', input.groupId] as const)
          : (['expenses', 'participant'] as const);

      // Seed the list cache so the new expense renders immediately without
      // waiting for a refetch that no-ops while offline.
      queryClient.setQueryData<Expense[]>(listKey, (old) =>
        old ? [newExpense, ...old] : [newExpense],
      );
      // Seed the detail cache so ExpenseDetailPage does not flash an error
      // if the user taps the expense before the background refetch completes.
      queryClient.setQueryData(['expenses', 'detail', newExpense.id], newExpense);

      queryClient.invalidateQueries({ queryKey: listKey });
      triggerGuestUpgradeReminderFromStore();
    },
  });
};
