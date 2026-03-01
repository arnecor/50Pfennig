/**
 * features/expenses/components/ExpenseForm.tsx
 *
 * Form for creating a new expense (equal split only, this ticket).
 *
 * Fields: description, amount, paid-by (read-only), split-with (multi-select).
 * Validation: Zod schema. Submission: useCreateExpense mutation.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckSquare, Square } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { money } from '@domain/types';
import type { Group, GroupMember, UserId } from '@domain/types';
import { useCreateExpense } from '../hooks/useCreateExpense';
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
  participantIds: z.array(z.string()).min(1, 'at_least_one'),
});

type FormValues = z.infer<typeof expenseSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  group: Group;
  currentUserId: UserId;
  currentUserDisplayName: string;
  onSuccess: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExpenseForm({
  group,
  currentUserId,
  currentUserDisplayName,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createExpense = useCreateExpense(group.id);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amountInput: '',
      participantIds: group.members.map((m) => m.userId),
    },
  });

  const amountInput = watch('amountInput');
  const participantIds = watch('participantIds');

  // Compute cents from the current input for the live preview
  const totalAmountCents = (() => {
    const n = Number.parseFloat(amountInput.replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) return money(0);
    return money(Math.round(n * 100));
  })();

  // Members for the live split preview
  const selectedMembers: GroupMember[] = group.members.filter((m) =>
    participantIds.includes(m.userId),
  );

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      const description =
        values.description?.trim() ||
        t('expenses.form.default_description', { name: currentUserDisplayName });

      const totalAmount = money(
        Math.round(Number.parseFloat(values.amountInput.replace(',', '.')) * 100),
      );

      await createExpense.mutateAsync({
        groupId: group.id,
        description,
        totalAmount,
        paidBy: currentUserId,
        split: { type: 'equal' },
        participants: values.participantIds as UserId[],
      });

      onSuccess();
    } catch (err) {
      console.error(err);
      setSubmitError(t('common.error_generic'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Description                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">{t('expenses.form.description_label')}</Label>
        <Input
          id="description"
          placeholder={t('expenses.form.description_placeholder_field')}
          maxLength={200}
          {...register('description')}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Amount                                                              */}
      {/* ------------------------------------------------------------------ */}
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

      {/* ------------------------------------------------------------------ */}
      {/* Paid by (read-only)                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('expenses.form.paid_by_label')}</Label>
        <Card className="bg-muted/40">
          <CardContent className="px-3 py-2.5">
            <p className="text-sm font-medium">{currentUserDisplayName}</p>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Split with (multi-select)                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('expenses.form.split_with_label')}</Label>
        <Controller
          name="participantIds"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              {group.members.map((member) => {
                const checked = field.value.includes(member.userId);
                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => {
                      const next = checked
                        ? field.value.filter((id) => id !== member.userId)
                        : [...field.value, member.userId];
                      field.onChange(next);
                    }}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      checked
                        ? 'border-primary/50 bg-primary/5 text-foreground'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0" />
                    )}
                    <span>{member.displayName}</span>
                    {member.userId === currentUserId && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t('expenses.form.you_badge')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        />
        {errors.participantIds && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {t('expenses.form.participants_error')}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Split preview (equal only)                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('expenses.form.split_type_label')}</Label>
        <SplitEditor totalAmount={totalAmountCents} participants={selectedMembers} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Submit error                                                        */}
      {/* ------------------------------------------------------------------ */}
      {submitError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {submitError}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Submit button                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || createExpense.isPending}
      >
        {isSubmitting || createExpense.isPending ? t('common.loading') : t('expenses.form.submit')}
      </Button>
    </form>
  );
}
