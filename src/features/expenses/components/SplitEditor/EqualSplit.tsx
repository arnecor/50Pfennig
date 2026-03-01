/**
 * features/expenses/components/SplitEditor/EqualSplit.tsx
 *
 * Read-only preview for an equal split.
 * Shows each participant's share derived from the total amount.
 * Uses the domain allocate() function to mirror the server-side calculation.
 */

import MoneyDisplay from '@components/shared/MoneyDisplay';
import { allocate } from '@domain/money';
import { money } from '@domain/types';
import type { GroupMember, Money } from '@domain/types';
import { Equal } from 'lucide-react';
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
    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
      {/* Info badge */}
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Equal className="h-4 w-4 shrink-0" />
        <span>{t('expenses.form.split_equal_info')}</span>
      </div>

      {/* Per-person preview */}
      {shares.length > 0 && (
        <ul className="space-y-1.5">
          {shares.map(({ member, amount }) => (
            <li key={member.userId} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{member.displayName}</span>
              <MoneyDisplay amount={amount} className="font-medium tabular-nums" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
