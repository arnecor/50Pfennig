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
import { AlertCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { cn } from '@/lib/utils';
import { UserAvatar } from '@components/shared/UserAvatar';
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
        ...(selectedFriends.length > 0 && { memberIds: selectedFriends }),
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
          <div className="mt-1 flex flex-col gap-2">
            {friends.map((friend) => {
              const isChecked = selectedFriends.includes(friend.userId);
              return (
                <button
                  key={friend.userId}
                  type="button"
                  onClick={() => handleToggleFriend(friend.userId)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                    isChecked
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                      isChecked ? 'bg-primary border-primary' : 'border-muted-foreground',
                    )}
                  >
                    {isChecked && (
                      <svg
                        className="w-3 h-3 text-primary-foreground"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <UserAvatar name={friend.displayName} size="md" />
                  <span className="font-medium text-foreground">{friend.displayName}</span>
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
      <Button
        type="submit"
        className="w-full h-12 font-semibold text-base bg-accent hover:bg-accent/90 text-accent-foreground"
        disabled={isPending}
      >
        {isPending ? t('groups.creating') : t('groups.create_button')}
      </Button>
    </form>
  );
}
