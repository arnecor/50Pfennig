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

## Auth — getting the current user in a component
```typescript
// In components / page hooks:
const { user } = useAuth();
const currentUserId = user?.id as UserId | undefined;
const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

// In non-component hooks (no router context needed):
const userId = useAuthStore(s => s.session?.user.id) as UserId | undefined;
```

## Deriving balances
```typescript
const balances = useMemo(
  () => expenses && settlements && group
    ? calculateGroupBalances(expenses, settlements, group.members)
    : null,
  [expenses, settlements, group]
);
```
