/**
 * features/groups/hooks/useGroupEvents.ts
 *
 * TanStack Query hook for fetching group lifecycle events (member
 * joined / left). Used by GroupDetailPage (activity feed) and
 * GroupSettingsPage.
 */

import type { GroupId } from '@domain/types';
import { groupEventsQueryOptions } from '@features/groups/groupQueries';
import { useQuery } from '@tanstack/react-query';

export const useGroupEvents = (groupId: GroupId) =>
  useQuery(groupEventsQueryOptions(groupId));
