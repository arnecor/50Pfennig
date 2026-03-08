/**
 * features/activities/types.ts
 *
 * Resolved activity item types for the home screen feed.
 * All display data is pre-resolved in the hook — the component is a pure renderer.
 */

import type { GroupId, Money } from '@domain/types';

export type ActivityItem = {
  id: string;
  date: Date;
} & (
  | {
      type: 'expense';
      description: string;
      totalAmount: Money;
      paidByCurrentUser: boolean;
      paidByName: string;
      myShare: Money;
      context: 'group' | 'friend';
      groupName?: string;
      groupId?: GroupId;
    }
  | {
      type: 'settlement';
      amount: Money;
      isMePaying: boolean;
      otherPartyName: string;
      context: 'group' | 'friend';
      groupName?: string;
      groupId?: GroupId;
    }
  | {
      type: 'group_membership';
      groupId: GroupId;
      groupName: string;
    }
);
