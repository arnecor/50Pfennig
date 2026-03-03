-- =============================================================================
-- Migration: 0007_fix_group_members_insert_policy
-- Description: Fix RLS on group_members INSERT for group creator
--
-- Problem:
--   When a group is first created, the creator inserts themselves into
--   group_members. The existing INSERT policy checks is_group_member(group_id),
--   which returns false because there are no members yet → 42501.
--
-- Fix:
--   Also allow the group creator (groups.created_by = auth.uid()) to insert.
-- =============================================================================

drop policy if exists "group_members: members can add others" on public.group_members;

create policy "group_members: members and creator can add"
  on public.group_members for insert
  with check (
    public.is_group_member(group_id)
    or exists (
      select 1 from public.groups g
      where g.id = group_id
        and g.created_by = auth.uid()
    )
  );
