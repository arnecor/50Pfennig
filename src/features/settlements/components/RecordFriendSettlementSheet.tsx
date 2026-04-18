/**
 * features/settlements/components/RecordFriendSettlementSheet.tsx
 *
 * Bottom-sheet overlay for settling up with a friend.
 *
 * The From/To are fixed labels (no pickers) derived from who owes whom.
 * The amount is pre-filled with the absolute net bilateral balance.
 *
 * Cross-context allocation (ADR-0012):
 *   contextDebts are passed in from the parent (FriendDetailPage), which
 *   computes them from simplified group debts + direct bilateral balance.
 *   allocateSettlement() distributes the payment across all contexts.
 */

import { UserAvatar } from '@components/shared/UserAvatar';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { abs, add, isNegative, negate } from '@domain/money';
import type { ContextDebt } from '@domain/settlement';
import { allocateSettlement } from '@domain/settlement';
import type { Friend, Money, UserId } from '@domain/types';
import { ZERO, money } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { useCreateSettlement } from '@features/settlements/hooks/useCreateSettlement';
import { useRequireOnline } from '@lib/connectivity/useRequireOnline';
import { ArrowRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  friend: Friend;
  currentUserId: UserId;
  /** Per-context debts between currentUser and friend, already computed by parent.
   *  Positive = friend owes currentUser in that context.
   *  Negative = currentUser owes friend in that context. */
  contextDebts: ContextDebt[];
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Amount parsing helpers
// ---------------------------------------------------------------------------

function parseAmountCents(input: string): number {
  const normalized = input
    .trim()
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
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
  contextDebts,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const createSettlement = useCreateSettlement();
  const { disabled: offlineDisabled, hint: offlineHint } = useRequireOnline();
  const currentUserDisplayName = useAuthStore(
    (s) => s.session?.user.user_metadata?.display_name as string | undefined,
  );

  // Net bilateral balance (positive = friend owes me)
  const netBilateral = useMemo(
    () => contextDebts.reduce((sum, d) => add(sum, d.amount), ZERO),
    [contextDebts],
  );

  // Payment direction
  // fromUserId = who is paying, toUserId = who is receiving
  const fromUserId = isNegative(netBilateral) ? currentUserId : friend.userId;
  const toUserId = isNegative(netBilateral) ? friend.userId : currentUserId;

  const [amountStr, setAmountStr] = useState(centsToInputString(abs(netBilateral)));
  const [note, setNote] = useState('');
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
        : contextDebts.map((d) => ({ ...d, amount: negate(d.amount) }));

    const allocations = allocateSettlement(paymentAmount, fromUserId, toUserId, debtsForAllocation);

    const trimmedNote = note.trim();
    await createSettlement.mutateAsync({
      fromUserId,
      toUserId,
      ...(trimmedNote ? { note: trimmedNote } : {}),
      allocations,
    });
    onClose();
  };

  const youLabel = currentUserDisplayName ?? t('common.you');
  const fromName = fromUserId === currentUserId ? t('common.you') : friend.displayName;
  const toName = toUserId === currentUserId ? t('common.you') : friend.displayName;
  const fromAvatar = fromUserId === currentUserId ? youLabel : friend.displayName;
  const toAvatar = toUserId === currentUserId ? youLabel : friend.displayName;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55] bg-black/40"
        onClick={onClose}
        onKeyDown={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 z-[60] flex flex-col rounded-t-2xl bg-background shadow-xl"
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
          <div className="mb-6 mt-4 flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <UserAvatar name={fromAvatar} size="lg" />
              <p className="text-sm font-medium">{fromName}</p>
            </div>
            <div className="flex flex-col items-center pb-5">
              <div className="h-0.5 w-10 bg-primary" />
              <ArrowRight className="h-4 w-4 -mt-2 text-primary" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <UserAvatar name={toAvatar} size="lg" />
              <p className="text-sm font-medium">{toName}</p>
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
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setAmountError('');
                }}
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
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={createSettlement.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={createSettlement.isPending || offlineDisabled}
              onClick={handleSubmit}
            >
              {createSettlement.isPending ? t('common.loading') : t('settlements.submit')}
            </Button>
          </div>
          {offlineHint && (
            <p className="mt-2 text-center text-xs text-muted-foreground">{offlineHint}</p>
          )}
          {createSettlement.isError && (
            <p className="mt-2 text-center text-xs text-destructive">{t('common.error_generic')}</p>
          )}
        </div>
      </div>
    </>
  );
}
