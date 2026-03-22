/**
 * features/expenses/components/SplitEditor/CustomSplitEditor.tsx
 *
 * Collapsible split editor that lets users customize how an expense is split.
 * - Collapsed by default, showing just "Aufteilung ▸"
 * - Expanded: participant list with fully editable amount/percentage fields
 * - Toggle between € and % modes
 * - Auto-adjusts last participant to ensure sum = totalAmount
 * - Exposes validation state via onChange callback
 */

import { ChevronRight, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  onChange: (shares: SplitShare[], isValid: boolean) => void;
};

type DisplayMode = 'amount' | 'percent';

// ---------------------------------------------------------------------------
// ShareInput — fully self-contained editable field
// ---------------------------------------------------------------------------

type ShareInputProps = {
  value: string; // formatted value to display when not focused
  suffix: string; // '€' or '%'
  onCommit: (raw: string) => void;
};

function ShareInput({ value, suffix, onCommit }: ShareInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const isFocused = useRef(false);

  // Sync incoming value only when the field is not being actively edited
  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(value);
    }
  }, [value]);

  return (
    <div className="relative w-24">
      <input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => {
          isFocused.current = true;
          // Select all on focus so user can overwrite immediately
          e.target.select();
        }}
        onBlur={() => {
          isFocused.current = false;
          onCommit(localValue);
        }}
        className={[
          'w-full rounded-lg border border-border bg-muted/40 px-2 py-1.5 pr-6',
          'text-right text-sm font-semibold tabular-nums text-foreground',
          'outline-none transition-[border-color,box-shadow]',
          'focus:border-ring focus:ring-2 focus:ring-ring/20',
        ].join(' ')}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CustomSplitEditor
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
  const [sharesCents, setSharesCents] = useState<Map<UserId, number>>(new Map());

  // Sort participants: paidByUserId first
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.userId === paidByUserId) return -1;
      if (b.userId === paidByUserId) return 1;
      return 0;
    });
  }, [participants, paidByUserId]);

  // Notify parent
  const notifyChange = useCallback(
    (map: Map<UserId, number>) => {
      const sum = Array.from(map.values()).reduce((a, b) => a + b, 0);
      const sharesArray = participants.map((p) => ({
        userId: p.userId,
        amountCents: map.get(p.userId) ?? 0,
      }));
      onChange(sharesArray, sum === totalAmount);
    },
    [participants, totalAmount, onChange],
  );

  // Reset to equal split (also used on init)
  const applyEqualSplit = useCallback(
    (parts: GroupMember[]) => {
      if (parts.length === 0 || totalAmount <= 0) {
        setSharesCents(new Map());
        onChange([], true);
        return;
      }
      const equalShares = allocate(
        totalAmount,
        parts.map(() => 1),
      );
      const newMap = new Map<UserId, number>();
      parts.forEach((p, i) => newMap.set(p.userId, equalShares[i] ?? 0));
      setSharesCents(newMap);
      notifyChange(newMap);
    },
    [totalAmount, onChange, notifyChange],
  );

  // Re-initialize only when participants or totalAmount change.
  // applyEqualSplit is intentionally excluded: it depends on onChange/notifyChange
  // which get new references on every render, so including it would reset user
  // edits after every keystroke.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    applyEqualSplit(participants);
  }, [participants, totalAmount]);

  // Compute display string for a participant's cents value
  const formatValue = (cents: number): string => {
    if (displayMode === 'amount') {
      return (cents / 100).toFixed(2).replace('.', ',');
    }
    if (totalAmount === 0) return '0';
    const pct = (cents / totalAmount) * 100;
    return pct.toFixed(2).replace('.', ',').replace(/,?0+$/, '') || '0';
  };

  // Commit a user edit for one participant
  const handleCommit = (userId: UserId, raw: string) => {
    const newMap = new Map(sharesCents);

    if (displayMode === 'amount') {
      const parsed = Number.parseFloat(raw.replace(',', '.'));
      const cents = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
      newMap.set(userId, Math.max(0, cents));
    } else {
      const parsed = Number.parseFloat(raw.replace(',', '.'));
      const pct = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
      newMap.set(userId, Math.round((pct / 100) * totalAmount));
    }

    setSharesCents(newMap);
    notifyChange(newMap);
  };

  const sumCents = useMemo(
    () => Array.from(sharesCents.values()).reduce((a, b) => a + b, 0),
    [sharesCents],
  );
  const isValid = sumCents === totalAmount;

  if (participants.length === 0) return null;

  const suffix = displayMode === 'amount' ? '€' : '%';

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
      >
        <span className="text-sm font-medium text-foreground">
          {t('expenses.form.split_section_title')}
        </span>
        <ChevronRight
          className={[
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isExpanded ? 'rotate-90' : '',
          ].join(' ')}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Toggle + Reset row */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
            <div className="flex overflow-hidden rounded-lg border border-border text-xs font-medium">
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

            <button
              type="button"
              onClick={() => applyEqualSplit(participants)}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              {t('expenses.form.split_reset')}
            </button>
          </div>

          {/* Participant rows */}
          <ul>
            {sortedParticipants.map((member) => {
              const cents = sharesCents.get(member.userId) ?? 0;
              const displayName =
                member.userId === currentUserId
                  ? t('expenses.form.split_own_share')
                  : member.displayName;

              return (
                <li
                  key={member.userId}
                  className="flex items-center gap-3 border-t border-border px-4 py-3"
                >
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {displayName}
                  </span>
                  <ShareInput
                    value={formatValue(cents)}
                    suffix={suffix}
                    onCommit={(raw) => handleCommit(member.userId, raw)}
                  />
                </li>
              );
            })}
          </ul>

          {/* Validation warning */}
          {!isValid && totalAmount > 0 && (
            <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
              {displayMode === 'percent'
                ? t('expenses.form.split_percent_mismatch', {
                    actual:
                      ((sumCents / totalAmount) * 100)
                        .toFixed(2)
                        .replace('.', ',')
                        .replace(/,?0+$/, '') || '0',
                  })
                : t('expenses.form.split_sum_mismatch', {
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
