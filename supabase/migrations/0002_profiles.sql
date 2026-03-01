-- =============================================================================
-- Migration: 0002_profiles
-- Description: Replace group_members.display_name with a public.profiles table.
--
-- Motivation:
--   group_members.display_name was a snapshot that drifted when users changed
--   their name. profiles is a single row per user — the canonical source of
--   truth for display names across all groups.
--
-- Changes:
--   1. Create public.profiles (id → auth.users, display_name, updated_at)
--   2. RLS: all authenticated users can read; each user can update their own row
--   3. Trigger: auto-create profile row on auth.users INSERT
--   4. Backfill: copy existing display_names from group_members + auth.users
--   5. Re-point group_members.user_id FK → profiles.id (enables JS client JOIN)
--   6. Drop group_members.display_name column
-- =============================================================================


-- =============================================================================
-- 1. Create profiles table
-- =============================================================================

create table public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  display_name text        not null default '' check (char_length(display_name) <= 80),
  updated_at   timestamptz not null default now()
);


-- =============================================================================
-- 2. Row Level Security
-- =============================================================================

alter table public.profiles enable row level security;

-- Any authenticated user can read all profiles (needed for group member names)
create policy "profiles: authenticated users can read"
  on public.profiles for select
  using (auth.uid() is not null);

-- Users can only update their own profile
create policy "profiles: users can update own"
  on public.profiles for update
  using (auth.uid() = id);


-- =============================================================================
-- 3. Trigger: auto-create profile on user signup
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1),
      ''
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 4. Backfill existing data
-- =============================================================================

-- (a) Copy display names from group_members for users already in groups
--     DISTINCT ON picks one name per user (arbitrary but consistent).
insert into public.profiles (id, display_name)
select distinct on (user_id) user_id, display_name
from public.group_members
on conflict (id) do nothing;

-- (b) Any auth users not yet covered: use user_metadata or email prefix
insert into public.profiles (id, display_name)
select
  id,
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1), '')
from auth.users
on conflict (id) do nothing;


-- =============================================================================
-- 5. Re-point group_members.user_id FK → profiles.id
--    This lets the Supabase JS client resolve the profiles relationship
--    when selecting group_members(..., profiles(display_name)).
-- =============================================================================

alter table public.group_members
  drop constraint group_members_user_id_fkey;

alter table public.group_members
  add constraint group_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;


-- =============================================================================
-- 6. Drop display_name from group_members (now sourced from profiles)
-- =============================================================================

alter table public.group_members
  drop column display_name;
