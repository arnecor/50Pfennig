/**
 * features/expenses/components/SplitEditor/CustomSplitEditor.tsx
 *
 * Collapsible split editor that lets users customize how an expense is split.
 * - Collapsed by default, showing just "Aufteilung ▸"
 * - Expanded: participant list with editable amount/percentage fields
 * - Toggle between € and % modes
 * - Auto-adjusts last participant to ensure sum = totalAmount
 * - Exposes validation state via onChange callback
 */

import { ChevronRight, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { allocate, formatMoney } from '@domain/money';
import { money } from '@domain/types';
import type { GroupMember, Money, UserId } from '@domain/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SplitShare = {
  userId: UserId;
  amountCents: number;
};

type Props = {
  totalAmount: Money;
  participants: GroupMember[];
  paidByUserId: UserId;
  currentUserId: UserId;
  /** Called whenever shares change; includes validity flag */
  onChange: (shares: SplitShare[], isValid: boolean) => void;
};

type DisplayMode = 'amount' | 'percent';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomSplitEditor({
  totalAmount,
  participants,
  paidByUserId,
  currentUserId,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('amount');

  // Internal state: cents per userId
  const [sharesCents, setSharesCents] = useState<Map<UserId, number>>(new Map());
  // Raw string values the user is actively typing (keyed by userId)
  const [rawInputs, setRawInputs] = useState<Map<UserId, string>>(new Map());

  // Sort participants: paidByUserId first
  const sortedParticipants = useMemo(() => {
    const sorted = [...participants];
    sorted.sort((a, b) => {
      if (a.userId === paidByUserId) return -1;
      if (b.userId === paidByUserId) return 1;
      return 0;
    });
    return sorted;
  }, [participants, paidByUserId]);

  // Initialize/reset shares when participants or totalAmount changes
  useEffect(() => {
    if (participants.length === 0 || totalAmount <= 0) {
      setSharesCents(new Map());
      onChange([], true);
      return;
    }

    const equalShares = allocate(
      totalAmount,
      participants.map(() => 1),
    );

    const newMap = new Map<UserId, number>();
    participants.forEach((p, i) => {
      newMap.set(p.userId, equalShares[i] ?? 0);
    });
    setSharesCents(newMap);
    setRawInputs(new Map()); // clear any in-progress edits

    const sharesArray = participants.map((p, i) => ({
      userId: p.userId,
      amountCents: equalShares[i] ?? 0,
    }));
    onChange(sharesArray, true);
  }, [participants, totalAmount, onChange]);

  // Calculate sum and validity
  const sumCents = useMemo(() => {
    let sum = 0;
    for (const cents of sharesCents.values()) {
      sum += cents;
    }
    return sum;
  }, [sharesCents]);

  const isValid = sumCents === totalAmount;

  // Notify parent of changes
  const notifyChange = useCallback(
    (newMap: Map<UserId, number>) => {
      const sum = Array.from(newMap.values()).reduce((a, b) => a + b, 0);
      const valid = sum === totalAmount;
      const sharesArray = participants.map((p) => ({
        userId: p.userId,
        amountCents: newMap.get(p.userId) ?? 0,
      }));
      onChange(sharesArray, valid);
    },
    [participants, totalAmount, onChange],
  );

  // Handle input change for a participant (onChange keeps raw string, onBlur commits)
  const handleInputChange = (userId: UserId, value: string) => {
    // Just store the raw string as the user types
    const newRaw = new Map(rawInputs);
    newRaw.set(userId, value);
    setRawInputs(newRaw);
  };

  const handleInputBlur = (userId: UserId, isLast: boolean) => {
    const value = rawInputs.get(userId);
    if (value === undefined) return;

    const newMap = new Map(sharesCents);

    if (displayMode === 'amount') {
      // Parse as euros, convert to cents
      const parsed = Number.parseFloat(value.replace(',', '.'));
      const cents = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
      newMap.set(userId, Math.max(0, cents));
    } else {
      // Parse as percentage, convert to cents
      const parsed = Number.parseFloat(value.replace(',', '.'));
      const percent = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
      const cents = Math.round((percent / 100) * totalAmount);
      newMap.set(userId, cents);
    }

    // Auto-adjust last participant if this is not the last one
    if (!isLast && sortedParticipants.length > 1) {
      const lastUserId = sortedParticipants[sortedParticipants.length - 1]!.userId;
      const othersSum = Array.from(newMap.entries())
        .filter(([uid]) => uid !== lastUserId)
        .reduce((sum, [, cents]) => sum + cents, 0);
      const remainder = Math.max(0, totalAmount - othersSum);
      newMap.set(lastUserId, remainder);
    }

    setSharesCents(newMap);
    // Clear raw input for this field
    const clearedRaw = new Map(rawInputs);
    clearedRaw.delete(userId);
    setRawInputs(clearedRaw);
    notifyChange(newMap);
  };

  // Reset to equal split
  const handleReset = () => {
    if (participants.length === 0 || totalAmount <= 0) return;

    const equalShares = allocate(
      totalAmount,
      participants.map(() => 1),
    );

    const newMap = new Map<UserId, number>();
    participants.forEach((p, i) => {
      newMap.set(p.userId, equalShares[i] ?? 0);
    });
    setSharesCents(newMap);
    setRawInputs(new Map());
    notifyChange(newMap);
  };

  // Format value for display
  const formatValue = (cents: number): string => {
    if (displayMode === 'amount') {
      return (cents / 100).toFixed(2).replace('.', ',');
    }
    if (totalAmount === 0) return '0';
    const percent = (cents / totalAmount) * 100;
    // Show up to 2 decimal places, but trim trailing zeros
    return percent.toFixed(2).replace('.', ',').replace(/,?0+$/, '') || '0';
  };

  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
      >
        <span className="text-sm font-medium text-foreground">
          {t('expenses.form.split_section_title')}
        </span>
        <ChevronRight
          className={[
            'h-4 w-4 text-muted-foreground transition-transform',
            isExpanded ? 'rotate-90' : '',
          ].join(' ')}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Toggle + Reset row */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => setDisplayMode('amount')}
                className={[
                  'px-3 py-1 transition-colors',
                  displayMode === 'amount'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted',
                ].join(' ')}
              >
                {t('expenses.form.split_toggle_amount')}
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('percent')}
                className={[
                  'px-3 py-1 transition-colors',
                  displayMode === 'percent'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted',
                ].join(' ')}
              >
                {t('expenses.form.split_toggle_percent')}
              </button>
            </div>

            {/* Reset button */}
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              {t('expenses.form.split_reset')}
            </button>
          </div>

          {/* Participant list */}
          <ul>
            {sortedParticipants.map((member, index) => {
              const isLast = index === sortedParticipants.length - 1;
              const cents = sharesCents.get(member.userId) ?? 0;
              const displayName =
                member.userId === currentUserId
                  ? t('expenses.form.split_own_share')
                  : member.displayName;

              return (
                <li
                  key={member.userId}
                  className="flex items-center gap-3 px-4 py-3 border-t border-border"
                >
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {displayName}
                  </span>
                  <div className="relative w-24">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rawInputs.has(member.userId) ? rawInputs.get(member.userId)! : formatValue(cents)}
                      onChange={(e) => handleInputChange(member.userId, e.target.value)}
                      onBlur={() => handleInputBlur(member.userId, isLast)}
                      onFocus={(e) => {
                        // Pre-fill raw input with current formatted value so user can edit it
                        const newRaw = new Map(rawInputs);
                        newRaw.set(member.userId, formatValue(cents));
                        setRawInputs(newRaw);
                        e.target.select();
                      }}
                      className={[
                        'w-full bg-muted/40 rounded-lg border border-border px-2 py-1.5 pr-6',
                        'text-sm text-right font-semibold tabular-nums text-foreground',
                        'outline-none focus:border-ring focus:ring-2 focus:ring-ring/20',
                        'transition-[border-color,box-shadow]',
                      ].join(' ')}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {displayMode === 'amount' ? '€' : '%'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Validation warning */}
          {!isValid && totalAmount > 0 && (
            <div className="px-4 py-2.5 bg-destructive/10 border-t border-destructive/20 text-xs text-destructive">
              {t('expenses.form.split_sum_mismatch', {
                actual: formatMoney(money(sumCents)),
                expected: formatMoney(money(totalAmount)),
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
