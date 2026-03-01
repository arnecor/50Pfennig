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

## Mutation with optimistic update
```typescript
useMutation({
  mutationFn: (input: CreateExpenseInput) => expenseRepository.create(input),
  onMutate: async (input) => {
    // cancel, snapshot previous, set optimistic data
  },
  onError: (err, input, ctx) => {
    // rollback
  },
  onSettled: (data, err, input) => {
    // invalidate
  },
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

## Deriving balances
```typescript
const balances = useMemo(
  () => expenses && settlements && group
    ? calculateGroupBalances(expenses, settlements, group.members)
    : null,
  [expenses, settlements, group]
);
```
