# Coding Patterns

## TanStack Query hook
```typescript
export const expenseQueryOptions = (groupId: GroupId) =>
  queryOptions({
    queryKey: ["expenses", groupId],
    queryFn: () => expenseRepository.getByGroupId(groupId),
  });

export const useExpenses = (groupId: GroupId) =>
  useQuery(expenseQueryOptions(groupId));
```

## Mutation — simple (most common)
```typescript
export const useCreateExpense = (groupId: GroupId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => expenseRepository.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
    },
  });
};
```

## Mutation — with optimistic update (only when needed)
```typescript
useMutation({
  mutationFn: (input) => expenseRepository.create(input),
  onMutate: async (input) => {
    // cancel in-flight, snapshot previous, set optimistic data
  },
  onError: (_err, _input, ctx) => { /* rollback */ },
  onSettled: () => { queryClient.invalidateQueries(...); },
});
```

## Zod schema
```typescript
export const createExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  totalAmount: z.number().int().positive(),
  // ...
});
```

## i18n
```typescript
const { t } = useTranslation();
return <p>{t("expenses.form.description_placeholder")}</p>;
```

## DB Mapper
```typescript
export const mapGroupMember = (row: GroupMemberRow): GroupMember => ({
  userId:      row.user_id  as UserId,
  groupId:     row.group_id as GroupId,
  displayName: row.display_name,
  joinedAt:    new Date(row.joined_at),
});
```

## Auth — getting the current user

**Rule:** use `useAuth()` in React components and hooks. Use `useAuthStore` only in
infrastructure/repository code that runs outside the React tree (e.g. a Zustand action
or a repository function).

```typescript
// ✅ In React components and page/feature hooks:
const { user } = useAuth();
const currentUserId = user?.id as UserId | undefined;
const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

// ✅ In Zustand actions or repository-layer code (no React context available):
const userId = useAuthStore(s => s.session?.user.id) as UserId | undefined;

// ❌ Do NOT use useAuthStore inside .tsx components when useAuth() is available
```

## Error Display

No toast, sonner, or dialog is used for errors. Always display errors inline.

```typescript
// Mutation error — store in local state, render below the action:
const [mutationError, setMutationError] = useState<string | null>(null);
const { mutate } = useMutation({
  mutationFn: ...,
  onError: (err) => setMutationError(err.message),
  onSuccess: () => setMutationError(null),
});
// In JSX:
{mutationError && <p className="text-sm text-destructive">{mutationError}</p>}

// Query error — use TanStack Query's isError field in the component layout:
const { data, isError, error } = useExpenses(groupId);
if (isError) return <p className="text-sm text-destructive">{error.message}</p>;

// Form validation error — react-hook-form field-level display:
{errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
```

Reference: `src/features/expenses/components/ExpenseForm.tsx` for form error display.

## Branded Type Comparisons

`UserId` and `GroupId` are branded types. TypeScript's `===` does not unwrap them, so
equality checks require an explicit cast. This is intentional and correct.

```typescript
// ✅ Correct — always add the comment so the cast is clearly intentional:
if ((e.paidBy as string) === (meId as string)) { ... }  // branded type; cast required for equality

// ❌ Do NOT use as string casts outside the domain/ and repositories/ layers
```

This pattern is acceptable in `src/domain/` and `src/repositories/` only.

Future improvement: a `isSameUser(a: UserId, b: UserId): boolean` helper in `src/domain/types.ts`
would centralize the pattern. Tracked in `STATUS.md`.

## Supabase Type Mismatches

Generated Supabase types sometimes diverge from the actual runtime shape (e.g. nullable RPC
params typed as non-nullable). When a cast is unavoidable, keep it in `src/repositories/` only
and always add an explanatory comment:

```typescript
// ✅ Acceptable in repositories/:
p_group_id: (input.groupId ?? null) as string,  // null is valid; generated types don't reflect nullable param

// ❌ Never cast Supabase types in hooks, components, or domain logic
```

Add a TODO comment if the mismatch should be fixed in the schema or after the next type
regeneration.

## Deriving balances
```typescript
const balances = useMemo(
  () => expenses && settlements && group
    ? calculateGroupBalances(expenses, settlements, group.members)
    : null,
  [expenses, settlements, group]
);
```
