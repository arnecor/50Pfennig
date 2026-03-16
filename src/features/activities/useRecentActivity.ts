/**
 * features/activities/useRecentActivity.ts
 *
 * Assembles a unified, sorted activity feed from all data sources:
 *   - Group expenses + settlements (per group)
 *   - Friend expenses + settlements (group_id IS NULL)
 *   - Group membership events (derived from useGroups)
 *
 * Activities are filtered to those involving the current user, sorted newest
 * first, and paginated in slices of PAGE_SIZE.
 *
 * All display data (names, signed amounts) is pre-resolved here so the
 * ActivityFeed component is a pure renderer.
 */

import { ZERO, abs, money } from '@domain/money';
import type { Friend, Group, Settlement, UserId } from '@domain/types';
import {
  expensesQueryOptions,
  friendExpensesQueryOptions,
} from '@features/expenses/expenseQueries';
import { useFriends } from '@features/friends/hooks/useFriends';
import { useGroups } from '@features/groups/hooks/useGroups';
import {
  friendSettlementsQueryOptions,
  settlementsQueryOptions,
} from '@features/settlements/settlementQueries';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ActivityItem } from './types';

const PAGE_SIZE = 10;

function resolveName(
  userId: string,
  currentIdStr: string,
  youLabel: string,
  groups: Group[],
  friends: Friend[],
): string {
  if (userId === currentIdStr) return youLabel;
  for (const group of groups) {
    const member = group.members.find((m) => (m.userId as string) === userId);
    if (member?.displayName) return member.displayName;
  }
  const friend = friends.find((f) => (f.userId as string) === userId);
  if (friend) return friend.displayName;
  return userId;
}

export function useRecentActivity(currentUserId: UserId | undefined, youLabel: string) {
  const [page, setPage] = useState(1);

  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const { data: friends = [], isLoading: friendsLoading } = useFriends();

  const expensesResults = useQueries({ queries: groups.map((g) => expensesQueryOptions(g.id)) });
  const settlementsResults = useQueries({
    queries: groups.map((g) => settlementsQueryOptions(g.id)),
  });

  const { data: friendExpenses = [], isLoading: friendExpensesLoading } = useQuery(
    friendExpensesQueryOptions(),
  );
  const { data: friendSettlements = [], isLoading: friendSettlementsLoading } = useQuery(
    friendSettlementsQueryOptions(),
  );

  const isLoading =
    groupsLoading ||
    friendsLoading ||
    friendExpensesLoading ||
    friendSettlementsLoading ||
    expensesResults.some((r) => r.isLoading) ||
    settlementsResults.some((r) => r.isLoading);

  const allItems = useMemo((): ActivityItem[] => {
    if (!currentUserId) return [];

    const currentIdStr = currentUserId as string;
    const getName = (uid: string) => resolveName(uid, currentIdStr, youLabel, groups, friends);
    const items: ActivityItem[] = [];

    // ── Group expenses ────────────────────────────────────────────────────────
    for (let i = 0; i < groups.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: loop bound guarantees i is in range
      const group = groups[i]!;
      const expenses = expensesResults[i]?.data ?? [];

      for (const expense of expenses) {
        const isInvolved =
          (expense.paidBy as string) === currentIdStr ||
          expense.splits.some((s) => (s.userId as string) === currentIdStr);
        if (!isInvolved) continue;

        const paidByCurrentUser = (expense.paidBy as string) === currentIdStr;
        const myShare =
          expense.splits.find((s) => (s.userId as string) === currentIdStr)?.amount ?? ZERO;

        items.push({
          id: expense.id,
          date: expense.createdAt,
          type: 'expense',
          description: expense.description,
          totalAmount: expense.totalAmount,
          paidByCurrentUser,
          paidByName: getName(expense.paidBy as string),
          myShare,
          context: 'group',
          groupName: group.name,
          groupId: group.id,
        });
      }
    }

    // ── Friend expenses ───────────────────────────────────────────────────────
    for (const expense of friendExpenses) {
      const paidByCurrentUser = (expense.paidBy as string) === currentIdStr;
      const myShare =
        expense.splits.find((s) => (s.userId as string) === currentIdStr)?.amount ?? ZERO;

      items.push({
        id: expense.id,
        date: expense.createdAt,
        type: 'expense',
        description: expense.description,
        totalAmount: expense.totalAmount,
        paidByCurrentUser,
        paidByName: getName(expense.paidBy as string),
        myShare,
        context: 'friend',
      });
    }

    // ── Settlements (all contexts, merged by batchId) ─────────────────────────
    // Collect every settlement record the current user is involved in, across
    // all groups and the direct (null groupId) context, then de-duplicate by id
    // and group by batchId. One real-world payment → one activity item.
    const allSettlementRecords = new Map<string, Settlement>();
    for (let i = 0; i < groups.length; i++) {
      for (const s of settlementsResults[i]?.data ?? []) {
        const isInvolved =
          (s.fromUserId as string) === currentIdStr || (s.toUserId as string) === currentIdStr;
        if (isInvolved) allSettlementRecords.set(String(s.id), s);
      }
    }
    for (const s of friendSettlements) {
      allSettlementRecords.set(String(s.id), s);
    }

    // Group by batchId (null batchId = standalone record, keyed by its own id)
    const batchMap = new Map<string, Settlement[]>();
    for (const s of allSettlementRecords.values()) {
      const key = s.batchId ?? String(s.id);
      const existing = batchMap.get(key) ?? [];
      existing.push(s);
      batchMap.set(key, existing);
    }

    for (const records of batchMap.values()) {
      // Compute net from currentUser's perspective (handles cross-direction records).
      let netFromMe = 0;
      let otherPartyId: string | null = null;
      let latestDate = new Date(0);
      for (const r of records) {
        const from = r.fromUserId as string;
        const to = r.toUserId as string;
        if (from === currentIdStr) {
          netFromMe += r.amount;
          otherPartyId = to;
        } else {
          netFromMe -= r.amount;
          otherPartyId = from;
        }
        if (r.createdAt > latestDate) latestDate = r.createdAt;
      }
      if (otherPartyId === null) continue;

      const isMePaying = netFromMe >= 0;
      items.push({
        // biome-ignore lint/style/noNonNullAssertion: records is non-empty (grouped by batch, guaranteed ≥1 record)
        id: records[0]!.id,
        date: latestDate,
        type: 'settlement',
        amount: abs(money(netFromMe)),
        isMePaying,
        otherPartyName: getName(otherPartyId),
        context: 'friend',
      });
    }

    // ── Group membership events ───────────────────────────────────────────────
    for (const group of groups) {
      const myMembership = group.members.find((m) => (m.userId as string) === currentIdStr);
      if (myMembership) {
        items.push({
          id: `membership-${group.id}`,
          date: myMembership.joinedAt,
          type: 'group_membership',
          groupId: group.id,
          groupName: group.name,
        });
      }
    }

    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items;
  }, [
    currentUserId,
    youLabel,
    groups,
    friends,
    expensesResults,
    settlementsResults,
    friendExpenses,
    friendSettlements,
  ]);

  const visibleItems = allItems.slice(0, page * PAGE_SIZE);
  const hasMore = visibleItems.length < allItems.length;
  const loadMore = () => setPage((p) => p + 1);

  return { items: visibleItems, isLoading, hasMore, loadMore };
}
