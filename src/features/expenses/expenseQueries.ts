/**
 * features/expenses/expenseQueries.ts
 *
 * TanStack Query key factories and query option objects for expense data.
 *
 * Query keys:
 *   ['expenses', groupId]             → all expenses for a group
 *   ['expenses', groupId, expenseId]  → single expense detail
 *
 * Invalidation: after any expense mutation, invalidate ['expenses', groupId].
 * The balance display (features/balances/) will automatically update
 * because it derives from the same cached expense data.
 */

// TODO: Implement after TanStack Query and expenseRepository are set up.

export {};
