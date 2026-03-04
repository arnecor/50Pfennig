/**
 * features/groups/components/CreateGroupForm.tsx
 *
 * Form for creating a new group.
 *
 * Fields:
 *   - Group name (required) — mandatory text input with a random placeholder
 *   - Members (optional) — checkbox list of friends to add on creation
 *     A hint tells users they can add members later too.
 *
 * Validation: Zod schema. Submission: useCreateGroup mutation.
 * On success: calls onSuccess(groupId) so the page can navigate to /groups/:groupId.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckSquare, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import type { Friend, GroupId, UserId } from '@domain/types';
import { useCreateGroup } from '../hooks/useCreateGroup';

// ---------------------------------------------------------------------------
// Random placeholder pool
// ---------------------------------------------------------------------------

const PLACEHOLDERS = [
  'Wochenendtrip',
  'Kühlschrankkosten',
  'Urlaubskasse',
  'Büromittagessen',
  'WG-Haushalt',
  'Grillabend',
  'Campingtrip',
  'Sportgruppe',
  'Spieleabend',
  'Haushaltskosten',
];

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const createGroupSchema = z.object({
  name: z.string().min(1, 'required'),
});

type FormValues = z.infer<typeof createGroupSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  friends: Friend[];
  onSuccess: (groupId: GroupId) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateGroupForm({ friends, onSuccess }: Props) {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<UserId[]>([]);

  const createGroup = useCreateGroup();

  const placeholder = useMemo(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)],
    [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: '' },
  });

  function handleToggleFriend(userId: UserId) {
    setSelectedFriends((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      const group = await createGroup.mutateAsync({
        name: values.name.trim(),
        memberIds: selectedFriends.length > 0 ? selectedFriends : undefined,
      });
      onSuccess(group.id as GroupId);
    } catch (err) {
      console.error(err);
      setSubmitError(t('common.error_generic'));
    }
  };

  const isPending = isSubmitting || createGroup.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* Group name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t('groups.name_label')}</Label>
        <Input
          id="name"
          placeholder={placeholder}
          autoFocus
          maxLength={100}
          {...register('name')}
        />
        {errors.name && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {t('groups.name_error_required')}
          </p>
        )}
      </div>

      {/* Optional friend list */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('groups.add_friends_section')}</Label>
        <p className="text-xs text-muted-foreground">{t('groups.add_members_hint')}</p>

        {friends.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t('groups.no_friends_at_all')}</p>
        ) : (
          <div className="mt-1 flex flex-col gap-1">
            {friends.map((friend) => {
              const isChecked = selectedFriends.includes(friend.userId);
              return (
                <button
                  key={friend.userId}
                  type="button"
                  onClick={() => handleToggleFriend(friend.userId)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted
                    ${isChecked ? 'font-medium text-primary' : 'text-foreground'}
                  `}
                >
                  {isChecked ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 text-left">{friend.displayName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? t('groups.creating') : t('groups.create_button')}
      </Button>
    </form>
  );
}
