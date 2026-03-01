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
import { AlertCircle, ChevronRight, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { money } from '@domain/types';
import type { Friend, Group, GroupId, GroupMember, UserId } from '@domain/types';
import { useCreateExpense } from '../hooks/useCreateExpense';
import ParticipantPicker, { type ParticipantSelection } from './ParticipantPicker';
import SplitEditor from './SplitEditor';

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
  groups:                  Group[];
  friends:                 Friend[];
  currentUserId:           UserId;
  currentUserDisplayName:  string;
  preselectedGroupId?:     GroupId;
  /** Called after successful creation. Receives the groupId if a group was selected, or null for friend expenses. */
  onSuccess:               (groupId: GroupId | null) => void;
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
  const [pickerOpen, setPickerOpen]   = useState(false);

  // Initialise with pre-selected group if navigated from group context.
  const preselectedGroup = preselectedGroupId
    ? groups.find(g => g.id === preselectedGroupId) ?? null
    : null;

  const [selection, setSelection] = useState<ParticipantSelection | null>(
    preselectedGroup ? { type: 'group', group: preselectedGroup } : null,
  );
  const [selectionError, setSelectionError] = useState<string | null>(null);

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
  const participantsForPreview: GroupMember[] = (() => {
    if (!selection) return [];
    if (selection.type === 'group') return [...selection.group.members];
    // Friend expense: selected friends + the current user
    const friendMembers: GroupMember[] = selection.userIds.map(uid => {
      const friend = friends.find(f => f.userId === uid);
      return {
        userId:      uid,
        groupId:     null as never, // no group context
        displayName: friend?.displayName ?? uid,
        joinedAt:    new Date(),
      };
    });
    const alreadyIncluded = friendMembers.some(m => m.userId === currentUserId);
    if (!alreadyIncluded) {
      friendMembers.unshift({
        userId:      currentUserId,
        groupId:     null as never,
        displayName: currentUserDisplayName,
        joinedAt:    new Date(),
      });
    }
    return friendMembers;
  })();

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    setSelectionError(null);

    if (!selection) {
      setSelectionError(t('expenses.form.participants_error'));
      return;
    }

    try {
      const description =
        values.description?.trim() ||
        t('expenses.form.default_description', { name: currentUserDisplayName });

      const totalAmount = money(
        Math.round(Number.parseFloat(values.amountInput.replace(',', '.')) * 100),
      );

      const participants = participantsForPreview.map(m => m.userId);

      const groupId = selection.type === 'group' ? selection.group.id : null;

      await createExpense.mutateAsync({
        groupId,
        description,
        totalAmount,
        paidBy:      currentUserId,
        split:       { type: 'equal' },
        participants,
      });

      onSuccess(groupId);
    } catch (err) {
      console.error(err);
      setSubmitError(t('common.error_generic'));
    }
  };

  // Selection summary label shown in the trigger chip
  const selectionLabel: string | null = (() => {
    if (!selection) return null;
    if (selection.type === 'group') return selection.group.name;
    return selection.userIds
      .map(uid => friends.find(f => f.userId === uid)?.displayName ?? uid)
      .join(', ');
  })();

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">{t('expenses.form.description_label')}</Label>
          <Input
            id="description"
            placeholder={t('expenses.form.description_placeholder_field')}
            maxLength={200}
            {...register('description')}
          />
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amountInput">{t('expenses.form.amount_label')}</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              €
            </span>
            <Input
              id="amountInput"
              inputMode="decimal"
              placeholder="0,00"
              className="pl-7"
              {...register('amountInput')}
            />
          </div>
          {errors.amountInput && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.amountInput.message === 'required'
                ? t('expenses.form.amount_error_required')
                : t('expenses.form.amount_error_positive')}
            </p>
          )}
        </div>

        {/* Paid by (read-only) */}
        <div className="flex flex-col gap-1.5">
          <Label>{t('expenses.form.paid_by_label')}</Label>
          <Card className="bg-muted/40">
            <CardContent className="px-3 py-2.5">
              <p className="text-sm font-medium">{currentUserDisplayName}</p>
            </CardContent>
          </Card>
        </div>

        {/* Split with — picker trigger */}
        <div className="flex flex-col gap-1.5">
          <Label>{t('expenses.form.split_with_label')}</Label>

          {selectionLabel ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/5 px-3 py-2.5">
              {selection?.type === 'group' && (
                <Users className="h-4 w-4 shrink-0 text-primary" />
              )}
              <button
                type="button"
                className="flex-1 text-left text-sm font-medium text-foreground"
                onClick={() => setPickerOpen(true)}
              >
                {selectionLabel}
              </button>
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label={t('common.cancel')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <span>{t('expenses.form.split_with_placeholder')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {selectionError && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {selectionError}
            </p>
          )}
        </div>

        {/* Split preview (shown only when participants are selected) */}
        {participantsForPreview.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>{t('expenses.form.split_type_label')}</Label>
            <SplitEditor totalAmount={totalAmountCents} participants={participantsForPreview} />
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting || createExpense.isPending}
        >
          {isSubmitting || createExpense.isPending ? t('common.loading') : t('expenses.form.submit')}
        </Button>
      </form>

      {/* ParticipantPicker overlay (outside form to avoid z-index issues) */}
      {pickerOpen && (
        <ParticipantPicker
          groups={groups}
          friends={friends}
          value={selection}
          onChange={setSelection}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
