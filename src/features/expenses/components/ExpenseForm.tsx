/**
 * features/expenses/components/ExpenseForm.tsx
 *
 * Form for creating a new expense.
 *
 * Fields: description, amount, paid-by (read-only), split-with (picker).
 * The "Teilen mit" field opens a ParticipantPicker overlay where the user
 * selects either a group OR one or more friends (never both).
 *
 * Validation: Zod schema. Submission: useCreateExpense mutation.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ChevronDown, ChevronRight, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@components/ui/button';
import { money } from '@domain/types';
import type { Friend, Group, GroupId, GroupMember, Money, UserId } from '@domain/types';
import { useCreateExpense } from '../hooks/useCreateExpense';
import ParticipantPicker, { type ParticipantSelection } from './ParticipantPicker';
import CustomSplitEditor, { type SplitShare } from './SplitEditor/CustomSplitEditor';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const expenseSchema = z.object({
  description: z.string().max(200).optional(),
  amountInput: z
    .string()
    .min(1, 'required')
    .refine((v) => {
      const n = Number.parseFloat(v.replace(',', '.'));
      return !Number.isNaN(n) && n > 0;
    }, 'must_be_positive'),
});

type FormValues = z.infer<typeof expenseSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  groups: Group[];
  friends: Friend[];
  currentUserId: UserId;
  currentUserDisplayName: string;
  preselectedGroupId?: GroupId;
  /** Called after successful creation. Receives the groupId if a group was selected, or null for friend expenses. */
  onSuccess: (groupId: GroupId | null) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExpenseForm({
  groups,
  friends,
  currentUserId,
  currentUserDisplayName,
  preselectedGroupId,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paidByUserId, setPaidByUserId] = useState<UserId>(currentUserId);

  // Split editor state
  const [splitShares, setSplitShares] = useState<SplitShare[]>([]);
  const [isSplitValid, setIsSplitValid] = useState(true);

  const handleSplitChange = (shares: SplitShare[], isValid: boolean) => {
    setSplitShares(shares);
    setIsSplitValid(isValid);
  };

  // Initialise with pre-selected group if navigated from group context.
  const preselectedGroup = preselectedGroupId
    ? (groups.find((g) => g.id === preselectedGroupId) ?? null)
    : null;

  const [selection, setSelection] = useState<ParticipantSelection | null>(
    preselectedGroup
      ? {
          type: 'group',
          group: preselectedGroup,
          selectedMemberIds: preselectedGroup.members.map((m) => m.userId),
        }
      : null,
  );
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const handleSelectionChange = (next: ParticipantSelection | null) => {
    setSelection(next);
    // If the previously chosen payer is no longer among the new participants, reset to self.
    if (next === null) {
      setPaidByUserId(currentUserId);
      return;
    }
    // Use selectedMemberIds for groups (only selected members participate)
    const nextIds: UserId[] =
      next.type === 'group' ? next.selectedMemberIds : [currentUserId, ...next.userIds];
    if (!nextIds.includes(paidByUserId)) {
      setPaidByUserId(currentUserId);
    }
  };

  const createExpense = useCreateExpense();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { description: '', amountInput: '' },
  });

  const amountInput = watch('amountInput');

  const totalAmountCents = (() => {
    const n = Number.parseFloat(amountInput.replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) return money(0);
    return money(Math.round(n * 100));
  })();

  // Derive the participant list for the split preview.
  // Must be memoized — a new array reference on every render would cause
  // CustomSplitEditor's useEffect to reset splits to equal on every state update.
  const participantsForPreview = useMemo<GroupMember[]>(() => {
    if (!selection) return [];
    // For groups, only include selected members (not all group members)
    if (selection.type === 'group') {
      return selection.group.members.filter((m) => selection.selectedMemberIds.includes(m.userId));
    }
    // Friend expense: selected friends + the current user
    const friendMembers: GroupMember[] = selection.userIds.map((uid) => {
      const friend = friends.find((f) => f.userId === uid);
      return {
        userId: uid,
        groupId: null as never, // no group context
        displayName: friend?.displayName ?? uid,
        joinedAt: new Date(),
      };
    });
    const alreadyIncluded = friendMembers.some((m) => m.userId === currentUserId);
    if (!alreadyIncluded) {
      friendMembers.unshift({
        userId: currentUserId,
        groupId: null as never,
        displayName: currentUserDisplayName,
        joinedAt: new Date(),
      });
    }
    return friendMembers;
  }, [selection, friends, currentUserId, currentUserDisplayName]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    setSelectionError(null);

    if (!selection) {
      setSelectionError(t('expenses.form.participants_error'));
      return;
    }

    // Validate split sums to totalAmount
    if (!isSplitValid) {
      return;
    }

    try {
      const description =
        values.description?.trim() ||
        t('expenses.form.default_description', { name: currentUserDisplayName });

      const totalAmount = money(
        Math.round(Number.parseFloat(values.amountInput.replace(',', '.')) * 100),
      );

      const participants = participantsForPreview.map((m) => m.userId);

      const groupId = selection.type === 'group' ? selection.group.id : null;

      // Build split object from custom shares
      const allEqual = splitShares.every((s) => s.amountCents === splitShares[0]?.amountCents);
      const exactAmounts = Object.fromEntries(
        splitShares.map((s) => [s.userId, money(s.amountCents)]),
      ) as Record<UserId, Money>;

      await createExpense.mutateAsync({
        groupId,
        description,
        totalAmount,
        paidBy: paidByUserId,
        split: allEqual ? { type: 'equal' } : { type: 'exact', amounts: exactAmounts },
        participants,
      });

      onSuccess(groupId);
    } catch (err) {
      console.error(err);
      setSubmitError(t('common.error_generic'));
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* ── Hero amount input ── */}
        <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-card border border-border px-5 pt-5 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('expenses.form.amount_label')}
          </p>

          {/* Large currency + input row */}
          <div className="flex items-center justify-center gap-1 w-full">
            <span className="text-3xl font-bold text-primary/60 leading-none select-none">
              €
            </span>
            <input
              id="amountInput"
              inputMode="decimal"
              placeholder="0,00"
              aria-label={t('expenses.form.amount_label')}
              className={[
                'w-full min-w-0 bg-transparent text-center text-4xl font-bold tabular-nums leading-none',
                'placeholder:text-muted-foreground/30',
                'outline-none border-none focus:ring-0',
                errors.amountInput ? 'text-destructive' : 'text-primary',
              ]
                .filter(Boolean)
                .join(' ')}
              {...register('amountInput')}
            />
          </div>

          {/* Inline amount error */}
          {errors.amountInput && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors.amountInput.message === 'required'
                ? t('expenses.form.amount_error_required')
                : t('expenses.form.amount_error_positive')}
            </p>
          )}
        </div>

        {/* ── Description — separate card, clearly optional ── */}
        <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              {t('expenses.form.description_label')}
            </label>
            <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full">
              optional
            </span>
          </div>
          <input
            id="description"
            maxLength={200}
            placeholder={t('expenses.form.description_placeholder_field')}
            aria-label={t('expenses.form.description_label')}
            className={[
              'w-full bg-muted/40 rounded-xl border border-border px-3 py-2',
              'text-sm text-foreground placeholder:text-muted-foreground/50',
              'outline-none focus:border-ring focus:ring-2 focus:ring-ring/20',
              'transition-[border-color,box-shadow]',
            ].join(' ')}
            {...register('description')}
          />
        </div>

        {/* ── Details card (paid by + split with) ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Paid by row — selectable */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <label htmlFor="paidBySelect" className="text-sm text-muted-foreground shrink-0">
              {t('expenses.form.paid_by_label')}
            </label>
            <div className="relative flex-1 flex justify-end">
              <select
                id="paidBySelect"
                value={paidByUserId}
                onChange={(e) => setPaidByUserId(e.target.value as UserId)}
                disabled={participantsForPreview.length === 0}
                className={[
                  'appearance-none bg-muted/50 rounded-lg border border-border',
                  'px-3 py-1.5 pr-7 text-sm font-semibold text-foreground text-right',
                  'outline-none focus:border-ring focus:ring-2 focus:ring-ring/20',
                  'cursor-pointer transition-[border-color,box-shadow]',
                  'disabled:opacity-50 disabled:cursor-default',
                ].join(' ')}
              >
                {participantsForPreview.length === 0 ? (
                  <option value={currentUserId}>{currentUserDisplayName}</option>
                ) : (
                  participantsForPreview.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.userId === currentUserId
                        ? `${m.displayName} (${t('common.you')})`
                        : m.displayName}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Split with row — expands when multiple friends are selected */}
          <div className="flex flex-col px-4 py-3.5 gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('expenses.form.split_with_label')}
              </span>

              {selection ? (
                <button
                  type="button"
                  onClick={() => handleSelectionChange(null)}
                  aria-label={t('common.cancel')}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{t('expenses.form.split_with_placeholder')}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Selected: group — single pill */}
            {selection?.type === 'group' && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                {selection.group.name}
              </button>
            )}

            {/* Selected: friends — one pill per person */}
            {selection?.type === 'friends' && selection.userIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selection.userIds.map((uid) => {
                  const name = friends.find((f) => f.userId === uid)?.displayName ?? uid;
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      {name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  + {t('expenses.form.split_with_placeholder')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Selection error */}
        {selectionError && (
          <p className="flex items-center gap-1 text-sm text-destructive px-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {selectionError}
          </p>
        )}

        {/* ── Aufteilung (collapsible split editor) ── */}
        {participantsForPreview.length > 0 && (
          <CustomSplitEditor
            totalAmount={totalAmountCents}
            participants={participantsForPreview}
            paidByUserId={paidByUserId}
            currentUserId={currentUserId}
            onChange={handleSplitChange}
          />
        )}

        {/* ── Submit error ── */}
        {submitError && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        {/* ── Submit button ── */}
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-2xl h-14 text-base font-bold"
          disabled={isSubmitting || createExpense.isPending || !isSplitValid}
        >
          {isSubmitting || createExpense.isPending
            ? t('common.loading')
            : t('expenses.form.submit')}
        </Button>
      </form>

      {/* ParticipantPicker overlay (outside form to avoid z-index issues) */}
      {pickerOpen && (
        <ParticipantPicker
          groups={groups}
          friends={friends}
          value={selection}
          onChange={handleSelectionChange}
          onClose={() => setPickerOpen(false)}
          paidByUserId={paidByUserId}
        />
      )}
    </>
  );
}
