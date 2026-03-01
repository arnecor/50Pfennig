/**
 * features/expenses/components/SplitEditor/index.tsx
 *
 * The split configuration UI — rendered inside ExpenseForm.
 *
 * For this version: equal split only.
 * Renders EqualSplit which shows a live per-person preview.
 *
 * Future: ExactSplit.tsx and PercentageSplit.tsx will be added here
 * behind a split-type selector (separate ticket).
 */

import type { GroupMember, Money } from '@domain/types';
import EqualSplit from './EqualSplit';

type Props = {
  totalAmount: Money;
  participants: GroupMember[];
};

export default function SplitEditor({ totalAmount, participants }: Props) {
  return <EqualSplit totalAmount={totalAmount} participants={participants} />;
}
