-- =============================================================================
-- Migration: 0006_fix_groups_select_after_insert
-- Description: Fix RLS chicken-and-egg problems during group creation
--
-- Problem:
--   groupRepository.create() does:
--     1. INSERT into groups + .select().single()  → SELECT policy fires before
--        creator is in group_members → is_group_member() = false → 42501
--     2. INSERT into group_members → INSERT policy checks is_group_member(group_id)
--        → still false (no members yet) → 42501
--
-- Fix:
--   1. groups SELECT: also allow created_by = auth.uid()
--   2. group_members INSERT: also allow group creator (via groups.created_by)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. groups SELECT: creator can always see their own group
-- ---------------------------------------------------------------------------

drop policy if exists "groups: members can view" on public.groups;

create policy "groups: members and creator can view"
  on public.groups for select
  using (
    public.is_group_member(id)
    or auth.uid() = created_by
  );


-- ---------------------------------------------------------------------------
-- 2. group_members INSERT: also allow the group creator to add the first member
-- ---------------------------------------------------------------------------

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
