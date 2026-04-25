/**
 * lib/storage/offlineAwareExpenseRepository.ts
 *
 * Wrapper around SupabaseExpenseRepository that intercepts write operations
 * (create / update / delete) when the device is offline and enqueues them for
 * later replay instead of attempting the network call.
 *
 * Reads always go to the underlying repository — TanStack Query's persisted
 * cache handles offline reads; if the cache has the data, it serves from
 * cache; if not, the call fails which is acceptable for a cold start offline.
 *
 * See Offline Mode concept — "Tier 1 / Tier 2 scope" and "IDs & temp-ID
 * reconciliation".
 */

import { currencyCode } from '@domain/currency';
import { splitExpense } from '@domain/splitting';
import type {
  Expense,
  ExpenseId,
  ExpenseSplit,
  ExpenseSplitRecord,
  FxRate,
  GroupId,
  Money,
  UserId,
} from '@domain/types';
import { SupabaseExpenseRepository } from '@repositories/supabase/expenseRepository';
import type {
  CreateExpenseInput,
  IExpenseRepository,
  UpdateExpenseInput,
} from '@repositories/types';

import { useConnectivityStore } from '@lib/connectivity/connectivityStore';
import { isOfflineModeEnabled } from '@lib/featureFlags';
import { generateTempId } from '@lib/ids';
import { serialiseSplitConfig, serialiseSplits } from '@lib/supabase/mappers';

import { useAuthStore } from '@features/auth/authStore';

import { useOfflineQueue } from './offlineQueue';

/**
 * Returns true for fetch-level network failures (no TCP connection, DNS failure,
 * request aborted). Returns false for HTTP-level errors (4xx, 5xx) which carry
 * meaningful server responses and should not be silently queued.
 */
function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    /failed to fetch|network request failed|load failed/i.test((err as TypeError).message)
  );
}

/**
 * Builds the optimistic Expense snapshot returned by create() while offline.
 * It carries a temp id (prefixed `tmp_`) so the cache can display it and
 * flushOfflineQueue can later swap parent ids if dependent mutations follow.
 */
function buildOptimisticExpense(input: CreateExpenseInput, createdBy: UserId): Expense {
  const splitAmounts = splitExpense(input.totalAmount, input.participants, input.split);
  const splits: ExpenseSplitRecord[] = input.participants.map((userId) => ({
    userId,
    // biome-ignore lint/style/noNonNullAssertion: splitExpense guarantees a value for every participant
    amount: splitAmounts[userId]!,
  }));
  const now = new Date();
  return {
    id: generateTempId() as ExpenseId,
    groupId: input.groupId,
    description: input.description,
    totalAmount: input.totalAmount,
    paidBy: input.paidBy,
    split: input.split,
    splits,
    createdBy,
    createdAt: now,
    updatedAt: now,
    currency: input.currency ?? currencyCode('EUR'),
    fxRate: (input.fxRate ?? 1) as FxRate,
    baseTotalAmount: input.baseTotalAmount ?? input.totalAmount,
  };
}

function currentUserId(): UserId {
  const session = useAuthStore.getState().session;
  if (!session) {
    throw new Error('Cannot create expense offline without an authenticated session');
  }
  return session.user.id as UserId;
}

export class OfflineAwareExpenseRepository implements IExpenseRepository {
  private readonly inner = new SupabaseExpenseRepository();

  private shouldQueue(): boolean {
    if (!isOfflineModeEnabled()) return false;
    return useConnectivityStore.getState().status !== 'online';
  }

  /**
   * Marks the OS as disconnected so subsequent shouldQueue() calls return true,
   * then queues the write. Called when a live Supabase call fails with a network
   * error mid-session (soft-offline: OS still reports connected but packets lost).
   */
  private markOffline(): void {
    useConnectivityStore.getState().setOsConnected(false);
  }

  getById(id: ExpenseId): Promise<Expense> {
    return this.inner.getById(id);
  }

  getByGroupId(groupId: GroupId): Promise<Expense[]> {
    return this.inner.getByGroupId(groupId);
  }

  getByParticipant(): Promise<Expense[]> {
    return this.inner.getByParticipant();
  }

  getSharedWithUser(otherUserId: UserId): Promise<Expense[]> {
    return this.inner.getSharedWithUser(otherUserId);
  }

  async create(input: CreateExpenseInput): Promise<Expense> {
    if (this.shouldQueue()) return this.createOffline(input);

    try {
      return await this.inner.create(input);
    } catch (err) {
      if (isNetworkError(err) && isOfflineModeEnabled()) {
        this.markOffline();
        return this.createOffline(input);
      }
      throw err;
    }
  }

  private createOffline(input: CreateExpenseInput): Expense {
    const createdBy = currentUserId();
    const optimistic = buildOptimisticExpense(input, createdBy);

    // Pre-compute the split snapshot so replay doesn't depend on the domain
    // module being available in the queue context. It's also what the server
    // RPC expects as p_splits, so we serialise it once here.
    const splitRecords = optimistic.splits.map((s) => ({
      userId: s.userId,
      amount: s.amount,
    }));

    useOfflineQueue.getState().enqueue({
      id: optimistic.id as string,
      type: 'CREATE_EXPENSE',
      payload: {
        groupId: input.groupId,
        description: input.description,
        totalAmount: input.totalAmount as number,
        paidBy: input.paidBy as string,
        splitType: input.split.type,
        splitConfig: serialiseSplitConfig(input.split),
        splits: serialiseSplits(splitRecords),
      },
    });

    return optimistic;
  }

  async update(id: ExpenseId, input: UpdateExpenseInput): Promise<Expense> {
    if (this.shouldQueue()) return this.updateOffline(id, input);

    try {
      return await this.inner.update(id, input);
    } catch (err) {
      if (isNetworkError(err) && isOfflineModeEnabled()) {
        this.markOffline();
        return this.updateOffline(id, input);
      }
      throw err;
    }
  }

  private updateOffline(id: ExpenseId, input: UpdateExpenseInput): Expense {
    // Offline updates require the caller to pass the *full* merged snapshot
    // (totalAmount, split, paidBy, description, participants). The hook owns
    // the current expense from its TanStack cache and merges before calling
    // — we cannot reach Supabase for a fresh read. If a caller supplies a
    // partial input while offline the replay will surface a validation
    // error in Pending Changes, which is correct.
    if (
      input.totalAmount === undefined ||
      input.split === undefined ||
      input.paidBy === undefined ||
      input.description === undefined ||
      input.participants === undefined
    ) {
      throw new Error(
        'Offline expense update requires a full snapshot (totalAmount, split, paidBy, description, participants)',
      );
    }

    const totalAmount: Money = input.totalAmount;
    const split: ExpenseSplit = input.split;
    const paidBy: UserId = input.paidBy;
    const description = input.description;
    const participants: UserId[] = input.participants as UserId[];

    const splitAmounts = splitExpense(totalAmount, participants, split);
    const splitRecords = participants.map((userId) => ({
      userId,
      // biome-ignore lint/style/noNonNullAssertion: splitExpense guarantees a value for every participant
      amount: splitAmounts[userId]!,
    }));

    useOfflineQueue.getState().enqueue({
      id: id as string,
      type: 'UPDATE_EXPENSE',
      payload: {
        expenseId: id as string,
        description,
        totalAmount: totalAmount as number,
        paidBy: paidBy as string,
        splitType: split.type,
        splitConfig: serialiseSplitConfig(split),
        splits: serialiseSplits(splitRecords),
      },
    });

    const now = new Date();
    return {
      id,
      groupId: null,
      description,
      totalAmount,
      paidBy,
      split,
      splits: splitRecords.map((r) => ({ userId: r.userId, amount: r.amount as Money })),
      createdBy: currentUserId(),
      createdAt: now,
      updatedAt: now,
      currency: input.currency ?? currencyCode('EUR'),
      fxRate: (input.fxRate ?? 1) as FxRate,
      baseTotalAmount: input.baseTotalAmount ?? totalAmount,
    };
  }

  async delete(id: ExpenseId): Promise<void> {
    if (this.shouldQueue()) return this.deleteOffline(id);

    try {
      return await this.inner.delete(id);
    } catch (err) {
      if (isNetworkError(err) && isOfflineModeEnabled()) {
        this.markOffline();
        return this.deleteOffline(id);
      }
      throw err;
    }
  }

  private deleteOffline(id: ExpenseId): void {
    useOfflineQueue.getState().enqueue({
      id: id as string,
      type: 'DELETE_EXPENSE',
      payload: { expenseId: id as string },
    });
  }
}
