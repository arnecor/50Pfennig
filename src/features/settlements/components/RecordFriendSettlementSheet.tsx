/**
 * features/settlements/components/RecordFriendSettlementSheet.tsx
 *
 * Bottom-sheet overlay for settling up with a friend.
 *
 * The From/To are fixed labels (no pickers) derived from who owes whom.
 * The amount is pre-filled with the absolute net bilateral balance.
 *
 * Cross-context allocation (ADR-0012):
 *   Per-group bilateral balances are derived from sharedExpenses and
 *   sharedSettlements using computeBilateralBalance() — no extra queries.
 *   allocateSettlement() distributes the payment across all contexts.
 *
 * Bilateral balance formula per context:
 *   +sum(friend.split for expenses I paid in that context)
 *   -sum(my.split for expenses friend paid in that context)
 *   ±settlement adjustments
 */

import type { ContextDebt } from '@domain/settlement';
import { allocateSettlement } from '@domain/settlement';
import type { Expense, Friend, GroupId, Money, Settlement, UserId } from '@domain/types';
import { ZERO, money } from '@domain/types';
import { abs, add, isNegative, negate } from '@domain/money';
import { computeBilateralBalance } from '@domain/balance';
import { useCreateSettlement } from '@features/settlements/hooks/useCreateSettlement';
import { ArrowRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  friend: Friend;
  currentUserId: UserId;
  /** All expenses shared between currentUser and friend (group + direct). */
  sharedExpenses: Expense[];
  /** All settlements between currentUser and friend (any groupId). */
  sharedSettlements: Settlement[];
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Amount parsing helpers
// ---------------------------------------------------------------------------

function parseAmountCents(input: string): number {
  const normalized = input.trim().replace(',', '.').replace(/[^0-9.]/g, '');
  const val = Number.parseFloat(normalized);
  return Number.isNaN(val) ? 0 : Math.round(val * 100);
}

function centsToInputString(cents: Money): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecordFriendSettlementSheet({
  friend,
  currentUserId,
  sharedExpenses,
  sharedSettlements,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const createSettlement = useCreateSettlement();

  // Compute per-context bilateral balance from already-loaded data
  const contextDebts = useMemo((): ContextDebt[] => {
    const uniqueContexts = new Set<string>([
      ...sharedExpenses.map(e => String(e.groupId)),
      ...sharedSettlements.map(s => String(s.groupId)),
    ]);

    const debts: ContextDebt[] = [];
    for (const ctxKey of uniqueContexts) {
      const groupId = ctxKey === 'null' ? null : (ctxKey as GroupId);
      const ctxExpenses    = sharedExpenses.filter(e => String(e.groupId) === ctxKey);
      const ctxSettlements = sharedSettlements.filter(s => String(s.groupId) === ctxKey);
      const balance = computeBilateralBalance(
        ctxExpenses, ctxSettlements, currentUserId, friend.userId,
      );
      if (balance !== ZERO) {
        debts.push({ groupId, amount: balance });
      }
    }
    return debts;
  }, [sharedExpenses, sharedSettlements, currentUserId, friend.userId]);

  // Net bilateral balance (positive = friend owes me)
  const netBilateral = useMemo(
    () => contextDebts.reduce((sum, d) => add(sum, d.amount), ZERO),
    [contextDebts],
  );

  // Payment direction
  // fromUserId = who is paying, toUserId = who is receiving
  const fromUserId = isNegative(netBilateral) ? currentUserId : friend.userId;
  const toUserId   = isNegative(netBilateral) ? friend.userId  : currentUserId;

  const [amountStr, setAmountStr]   = useState(centsToInputString(abs(netBilateral)));
  const [note, setNote]             = useState('');
  const [amountError, setAmountError] = useState('');

  const handleSubmit = async () => {
    const cents = parseAmountCents(amountStr);
    if (!amountStr.trim()) {
      setAmountError(t('settlements.amount_error_required'));
      return;
    }
    if (cents <= 0) {
      setAmountError(t('settlements.amount_error_positive'));
      return;
    }

    setAmountError('');

    const paymentAmount = money(cents) as Money;

    // For allocateSettlement, debts must be from fromUserId's perspective:
    // positive = fromUserId owes toUserId (same direction as payment).
    // contextDebts are from currentUserId's perspective (positive = friend owes me).
    // When fromUserId = friend → same perspective → use as-is.
    // When fromUserId = currentUser → negate (flip perspective).
    const debtsForAllocation: ContextDebt[] =
      fromUserId === friend.userId
        ? contextDebts
        : contextDebts.map(d => ({ ...d, amount: negate(d.amount) }));

    const allocations = allocateSettlement(
      paymentAmount,
      fromUserId,
      toUserId,
      debtsForAllocation,
    );

    const trimmedNote = note.trim();
    await createSettlement.mutateAsync({
      fromUserId,
      toUserId,
      ...(trimmedNote ? { note: trimmedNote } : {}),
      allocations,
    });
    onClose();
  };

  const fromName = fromUserId === currentUserId ? t('common.you') : friend.displayName;
  const toName   = toUserId   === currentUserId ? t('common.you') : friend.displayName;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} onKeyDown={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background shadow-xl"
        style={{ bottom: 0, maxHeight: 'min(90dvh, calc(100vh - env(safe-area-inset-top, 24px)))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-base font-semibold">
            {t('settlements.record_friend_title', { name: friend.displayName })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label={t('common.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">

          {/* From → To (fixed, not a picker) */}
          <div className="mb-5 mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('settlements.from')}</p>
              <p className="mt-0.5 text-sm font-semibold">{fromName}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('settlements.to')}</p>
              <p className="mt-0.5 text-sm font-semibold">{toName}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="mb-4 flex flex-col gap-1.5">
            <Label htmlFor="friend-settlement-amount">{t('settlements.amount_label')}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                €
              </span>
              <Input
                id="friend-settlement-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amountStr}
                onChange={e => { setAmountStr(e.target.value); setAmountError(''); }}
                className="pl-7"
              />
            </div>
            {amountError && <p className="text-xs text-destructive">{amountError}</p>}
          </div>

          {/* Note */}
          <div className="mb-4 flex flex-col gap-1.5">
            <Label htmlFor="friend-settlement-note">{t('settlements.note_label')}</Label>
            <Input
              id="friend-settlement-note"
              placeholder={t('settlements.note_placeholder')}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            size="lg"
            className="w-full"
            disabled={createSettlement.isPending}
            onClick={handleSubmit}
          >
            {createSettlement.isPending ? t('common.loading') : t('settlements.submit')}
          </Button>
          {createSettlement.isError && (
            <p className="mt-2 text-center text-xs text-destructive">{t('common.error_generic')}</p>
          )}
        </div>
      </div>
    </>
  );
}
