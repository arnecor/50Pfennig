import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { money, type DebtInstruction, type Group, type Money, type UserId } from '@domain/types';
import { useAuthStore } from '@features/auth/authStore';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  group: Group;
  defaultDebt?: DebtInstruction;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (payload: { fromUserId: UserId; toUserId: UserId; amount: Money; note?: string }) => void;
};

const formatEuroInput = (amount: Money) => (Number(amount) / 100).toFixed(2);

export default function RecordSettlementSheet({
  group,
  defaultDebt,
  isPending,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const currentUserId = useAuthStore((s) => s.session?.user.id) as UserId | undefined;

  const defaultFrom = useMemo<UserId | undefined>(
    () => currentUserId ?? defaultDebt?.fromUserId ?? group.members[0]?.userId,
    [currentUserId, defaultDebt?.fromUserId, group.members],
  );

  const defaultTo = useMemo<UserId | undefined>(() => {
    if (defaultDebt?.toUserId && defaultDebt.toUserId !== defaultFrom) return defaultDebt.toUserId;
    return group.members.find((m) => m.userId !== defaultFrom)?.userId;
  }, [defaultDebt?.toUserId, defaultFrom, group.members]);

  const [fromUserId, setFromUserId] = useState<UserId | undefined>(defaultFrom);
  const [toUserId, setToUserId] = useState<UserId | undefined>(defaultTo);
  const [amountInput, setAmountInput] = useState(defaultDebt ? formatEuroInput(defaultDebt.amount) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFromUserId(defaultFrom);
    setToUserId(defaultTo);
    setAmountInput(defaultDebt ? formatEuroInput(defaultDebt.amount) : '');
    setError(null);
  }, [defaultDebt, defaultFrom, defaultTo]);

  const toOptions = useMemo(
    () => group.members.filter((member) => member.userId !== fromUserId),
    [group.members, fromUserId],
  );

  const handleSubmit = () => {
    setError(null);

    if (!fromUserId || !toUserId) {
      setError(t('common.error_generic'));
      return;
    }

    if (fromUserId === toUserId) {
      setError(t('common.error_generic'));
      return;
    }

    const normalized = amountInput.replace(',', '.').trim();
    const parsed = Number(normalized);
    const cents = Math.round(parsed * 100);

    if (!Number.isFinite(parsed) || normalized.length === 0 || cents <= 0) {
      setError(t('common.error_generic'));
      return;
    }

    onSubmit({
      fromUserId,
      toUserId,
      amount: money(cents),
      ...(note.trim().length > 0 ? { note: note.trim() } : {}),
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-background shadow-xl"
        style={{
          bottom: 0,
          maxHeight: 'min(85dvh, calc(100vh - env(safe-area-inset-top, 24px)))',
        }}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-base font-semibold">{t('settlements.record')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label={t('common.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settlement-from">{t('settlements.from')}</Label>
            <select
              id="settlement-from"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fromUserId ?? ''}
              onChange={(e) => {
                const nextFrom = e.target.value as UserId;
                setFromUserId(nextFrom);
                if (nextFrom === toUserId) {
                  const fallback = group.members.find((m) => m.userId !== nextFrom)?.userId;
                  setToUserId(fallback);
                }
              }}
            >
              {group.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settlement-to">{t('settlements.to')}</Label>
            <select
              id="settlement-to"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={toUserId ?? ''}
              onChange={(e) => setToUserId(e.target.value as UserId)}
            >
              {toOptions.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settlement-amount">{t('settlements.amount_label')}</Label>
            <Input
              id="settlement-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settlement-note">{t('settlements.note_label')}</Label>
            <Input
              id="settlement-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </>
  );
}
