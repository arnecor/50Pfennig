-- =============================================================================
-- 0003_fix_group_events_fk.sql
--
-- Fixes the group_events.user_id foreign key so that PostgREST can resolve
-- the profiles(display_name) join used in getEvents().
--
-- Root cause: 0002_group_events.sql declared user_id as references auth.users(id),
-- but PostgREST can only auto-join to public.profiles when the FK points directly
-- to public.profiles(id) — consistent with how group_members.user_id is declared.
-- profiles.id == auth.users.id (1:1), so no data changes are required.
-- =============================================================================

alter table public.group_events
  drop constraint group_events_user_id_fkey,
  add constraint group_events_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
