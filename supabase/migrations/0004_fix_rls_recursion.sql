-- =============================================================================
-- Migration: 0004_fix_rls_recursion
-- Description: Fix infinite RLS recursion between expenses and expense_splits
--
-- Problem:
--   The expenses SELECT policy (for friend expenses, group_id IS NULL) queries
--   expense_splits via a subquery. The expense_splits SELECT policy in turn queries
--   expenses. PostgreSQL does not guarantee short-circuit evaluation of OR conditions
--   in RLS policies, so even group expenses can trigger the circular reference,
--   causing error 42P17 ("infinite recursion detected in policy").
--
-- Fix:
--   Introduce a SECURITY DEFINER helper function can_access_expense() that checks
--   access to an expense (and its splits) without going through RLS. Both the
--   expenses SELECT policy and the expense_splits SELECT policy delegate to this
--   function, breaking the circular dependency.
--
--   This is the same pattern already used by is_group_member() to avoid recursion
--   in group_members policies.
-- =============================================================================


-- =============================================================================
-- 1. SECURITY DEFINER helper: can auth.uid() access the given expense?
--    Runs as the function owner (postgres / superuser), bypassing RLS on both
--    expenses and expense_splits to break the circular policy reference.
-- =============================================================================

create or replace function public.can_access_expense(p_expense_id uuid)
returns boolean
language sql
security definer
stable as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and (
        -- Group expense: caller must be a member of the group
        (e.group_id is not null and public.is_group_member(e.group_id))
        or
        -- Friend expense: caller must be the payer or a split participant
        (e.group_id is null and (
          e.paid_by = auth.uid()
          or exists (
            select 1 from public.expense_splits es
            where es.expense_id = p_expense_id
              and es.user_id    = auth.uid()
          )
        ))
      )
  );
$$;


-- =============================================================================
-- 2. Replace expenses SELECT policy — delegate to the helper.
-- =============================================================================

drop policy if exists "expenses: members and participants can view" on public.expenses;

create policy "expenses: members and participants can view"
  on public.expenses for select
  using (public.can_access_expense(id));


-- =============================================================================
-- 3. Replace expense_splits SELECT policy — delegate to the same helper.
-- =============================================================================

drop policy if exists "expense_splits: participants can view" on public.expense_splits;

create policy "expense_splits: participants can view"
  on public.expense_splits for select
  using (public.can_access_expense(expense_id));
