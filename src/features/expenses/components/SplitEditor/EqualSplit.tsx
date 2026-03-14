/**
 * features/expenses/components/SplitEditor/EqualSplit.tsx
 *
 * Read-only preview for an equal split.
 * Shows each participant's share derived from the total amount.
 * Uses the domain allocate() function to mirror the server-side calculation.
 */

import MoneyDisplay from '@components/shared/MoneyDisplay';
import { UserAvatar } from '@components/shared/UserAvatar';
import { allocate } from '@domain/money';
import { money } from '@domain/types';
import type { GroupMember, Money } from '@domain/types';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  totalAmount: Money;
  participants: GroupMember[];
};

export default function EqualSplit({ totalAmount, participants }: Props) {
  const { t } = useTranslation();

  const shares = useMemo(() => {
    if (participants.length === 0 || totalAmount <= 0) return [];
    const amounts = allocate(
      totalAmount,
      participants.map(() => 1),
    );
    return participants.map((member, i) => ({
      member,
      amount: amounts[i] ?? money(0),
    }));
  }, [totalAmount, participants]);

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {shares.length > 0 && (
        <ul>
          {shares.map(({ member, amount }) => (
            <li
              key={member.userId}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
            >
              <UserAvatar name={member.displayName} size="sm" />
              <span className="flex-1 text-sm font-medium text-foreground">{member.displayName}</span>
              <MoneyDisplay amount={amount} className="text-sm font-semibold tabular-nums" />
            </li>
          ))}
        </ul>
      )}
      <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-muted/30 border-t border-border">
        {t('expenses.form.split_equal_info')}
      </div>
    </div>
  );
}
