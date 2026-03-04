-- =============================================================================
-- Migration: 0009_create_group_rpc
-- Description: Introduce create_group RPC and revert the RLS patches from
--              migrations 0006–0008 that worked around the chicken-and-egg
--              problem during group creation.
--
-- Problem (recap):
--   groupRepository.create() made three separate Supabase client calls, each
--   hitting RLS independently. Migrations 0006–0008 relaxed the policies to
--   allow the group creator to bypass is_group_member() checks. This worked
--   but left the policies more permissive than intended.
--
-- Fix:
--   Wrap group creation in a SECURITY DEFINER RPC — the same pattern used
--   for create_expense. The RPC runs as the DB owner, bypassing RLS, so the
--   strict member-only policies can be restored.
--
-- After this migration:
--   - groups SELECT  → is_group_member(id) only  (0006 patch removed)
--   - group_members INSERT → is_group_member(group_id) only  (0006/0007 patches removed)
--   - group_members SELECT → is_group_member(group_id) only  (0008 patch removed)
-- =============================================================================


-- =============================================================================
-- RPC: create_group
--
-- Creates a group and adds the creator + optional extra members atomically.
-- Runs as SECURITY DEFINER so RLS is bypassed inside the function body.
-- Authorization: caller must be authenticated (auth.uid() is checked).
--
-- Parameters:
--   p_name        — display name for the group (1–100 chars)
--   p_member_ids  — optional UUIDs of additional members to add (beyond creator)
--
-- Returns: the newly inserted groups row
-- =============================================================================

create or replace function public.create_group(
  p_name       text,
  p_member_ids uuid[] default '{}'
)
returns public.groups
language plpgsql
security definer as $$
declare
  v_group  public.groups;
  v_uid    uuid;
  v_member uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  -- 1. Insert the group
  insert into public.groups (name, created_by)
  values (p_name, v_uid)
  returning * into v_group;

  -- 2. Add the creator as the first member
  insert into public.group_members (group_id, user_id)
  values (v_group.id, v_uid);

  -- 3. Add any additional members
  if p_member_ids is not null then
    foreach v_member in array p_member_ids loop
      insert into public.group_members (group_id, user_id)
      values (v_group.id, v_member);
    end loop;
  end if;

  return v_group;
end;
$$;


-- =============================================================================
-- Revert RLS patches — restore strict member-only policies
-- =============================================================================

-- ---------------------------------------------------------------------------
-- groups SELECT: revert 0006 patch (created_by fallback → member-only)
-- ---------------------------------------------------------------------------

drop policy if exists "groups: members and creator can view" on public.groups;

create policy "groups: members can view"
  on public.groups for select
  using (public.is_group_member(id));


-- ---------------------------------------------------------------------------
-- group_members INSERT: revert 0006 / 0007 patches (creator fallback → member-only)
-- ---------------------------------------------------------------------------

drop policy if exists "group_members: members and creator can add" on public.group_members;

create policy "group_members: members can add others"
  on public.group_members for insert
  with check (public.is_group_member(group_id));


-- ---------------------------------------------------------------------------
-- group_members SELECT: revert 0008 patch (user_id + creator fallback → member-only)
-- ---------------------------------------------------------------------------

drop policy if exists "group_members: members can view" on public.group_members;

create policy "group_members: members can view"
  on public.group_members for select
  using (public.is_group_member(group_id));
