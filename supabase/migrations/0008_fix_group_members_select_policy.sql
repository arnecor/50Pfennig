-- =============================================================================
-- Migration: 0008_fix_group_members_select_policy
-- Description: Fix RLS on group_members SELECT for group creator
--
-- Problem:
--   groupRepository.create() does .insert(...).select().single() on group_members.
--   The SELECT policy checks is_group_member(group_id). Even after the INSERT
--   succeeds, PostgREST evaluates the SELECT policy to return the row — but
--   is_group_member() may not yet reflect the just-inserted row within the same
--   request, causing .single() to get no rows back → 42501.
--
-- Fix:
--   Also allow the group creator or the member themselves to select the row.
-- =============================================================================

drop policy if exists "group_members: members can view" on public.group_members;

create policy "group_members: members can view"
  on public.group_members for select
  using (
    public.is_group_member(group_id)
    or user_id = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = group_id
        and g.created_by = auth.uid()
    )
  );
