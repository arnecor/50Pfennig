/**
 * features/settlements/components/RecordGroupSettlementSheet.tsx
 *
 * Bottom-sheet overlay for recording a payment within a group.
 *
 * The From/To pickers show group members only. The amount is pre-filled
 * when opened from a suggestion row (simplifyDebts result).
 *
 * Creates ONE allocation scoped to the group — no cross-context allocation
 * needed here because the user is explicitly settling a group-level debt.
 */

import { UserAvatar } from '@components/shared/UserAvatar';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import type { DebtInstruction, Group, Money, UserId } from '@domain/types';
import { money } from '@domain/types';
import { useCreateSettlement } from '@features/settlements/hooks/useCreateSettlement';
import { useBackHandler } from '@lib/capacitor/backHandler';
import { useRequireOnline } from '@lib/connectivity/useRequireOnline';
import { Circle, CircleDot, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  group: Group;
  currentUserId: UserId;
  /** Pre-filled suggestion from simplifyDebts(). Both fromUserId/toUserId and amount. */
  suggestion?: DebtInstruction;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
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

export default function RecordGroupSettlementSheet({
  group,
  currentUserId,
  suggestion,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const createSettlement = useCreateSettlement();
  const { disabled: offlineDisabled, hint: offlineHint } = useRequireOnline();

  useBackHandler(() => {
    onClose();
    return true;
  });

  const defaultFrom = suggestion?.fromUserId ?? group.members[0]?.userId;
  const defaultTo = suggestion?.toUserId ?? group.members[1]?.userId;

  const [fromUserId, setFromUserId] = useState<UserId | undefined>(defaultFrom);
  const [toUserId, setToUserId] = useState<UserId | undefined>(defaultTo);
  const [amountStr, setAmountStr] = useState(
    suggestion ? centsToInputString(suggestion.amount) : '',
  );
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState('');

  const memberName = (id: UserId) => {
    if (id === currentUserId) return t('common.you');
    const member = group.members.find((m) => m.userId === id);
    if (!member) return String(id);
    return member.isDeleted ? t('common.deleted_user') : member.displayName;
  };

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
    if (!fromUserId || !toUserId || fromUserId === toUserId) return;

    setAmountError('');

    const trimmedNote = note.trim();
    await createSettlement.mutateAsync({
      fromUserId,
      toUserId,
      ...(trimmedNote ? { note: trimmedNote } : {}),
      allocations: [{ groupId: group.id, fromUserId, toUserId, amount: money(cents) as Money }],
    });
    onClose();
  };

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
          <h2 className="text-base font-semibold">{t('settlements.record_group_title')}</h2>
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
          {/* From */}
          <section className="mb-5">
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('settlements.from')}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.members.map((m) => (
                <button
                  key={String(m.userId)}
                  type="button"
                  onClick={() => setFromUserId(m.userId)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    fromUserId === m.userId
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <UserAvatar name={m.displayName} size="sm" />
                  <span className="flex-1 text-left">{memberName(m.userId)}</span>
                  {fromUserId === m.userId ? (
                    <CircleDot className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* To */}
          <section className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('settlements.to')}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.members
                .filter((m) => m.userId !== fromUserId)
                .map((m) => (
                  <button
                    key={String(m.userId)}
                    type="button"
                    onClick={() => setToUserId(m.userId)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      toUserId === m.userId
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <UserAvatar name={m.displayName} size="sm" />
                    <span className="flex-1 text-left">{memberName(m.userId)}</span>
                    {toUserId === m.userId ? (
                      <CircleDot className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                ))}
            </div>
          </section>

          {/* Amount */}
          <div className="mb-4 flex flex-col gap-1.5">
            <Label htmlFor="settlement-amount">{t('settlements.amount_label')}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                €
              </span>
              <Input
                id="settlement-amount"
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
            <Label htmlFor="settlement-note">{t('settlements.note_label')}</Label>
            <Input
              id="settlement-note"
              placeholder={t('settlements.note_placeholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 pt-4 pb-safe">
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
              disabled={
                !fromUserId ||
                !toUserId ||
                fromUserId === toUserId ||
                createSettlement.isPending ||
                offlineDisabled
              }
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
