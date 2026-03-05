-- =============================================================================
-- Migration: 0014_friend_invites
-- Description: Add friend invite tokens + RPC functions for adding friends
--
-- Changes:
--   1. New table: friend_invites (invite link tokens with expiry)
--   2. RPC: create_friend_invite()  — generate a shareable invite token
--   3. RPC: accept_friend_invite()  — validate token, create friendship
--   4. RPC: search_user_by_email()  — find a registered user by email
--   5. RPC: add_friend_by_id()      — create friendship directly (email search flow)
--
-- Key design decisions:
--   - friend_invites stores link tokens, NOT pending friendship requests.
--     Friendships are always auto-accepted on use.
--   - Tokens expire after 7 days as a security measure.
--   - Tokens are single-use (used_by is set on acceptance).
--   - accept_friend_invite handles edge cases: expired, self-invite, already friends.
--   - search_user_by_email uses SECURITY DEFINER to read auth.users (not
--     accessible via RLS).
-- =============================================================================


-- =============================================================================
-- 1. friend_invites table
-- =============================================================================

create table public.friend_invites (
  id           uuid        primary key default gen_random_uuid(),
  token        text        not null unique default encode(gen_random_bytes(16), 'hex'),
  inviter_id   uuid        not null references public.profiles(id) on delete cascade,
  used_by      uuid        references public.profiles(id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now()
);

create index idx_friend_invites_token   on public.friend_invites(token);
create index idx_friend_invites_inviter on public.friend_invites(inviter_id);


-- =============================================================================
-- 2. RLS: friend_invites
-- =============================================================================

alter table public.friend_invites enable row level security;

-- Any authenticated user can read invites (needed for token lookup during accept)
create policy "friend_invites: authenticated can view"
  on public.friend_invites for select
  using (auth.uid() is not null);

-- Users can create invites as themselves
create policy "friend_invites: users can create own"
  on public.friend_invites for insert
  with check (inviter_id = auth.uid());


-- =============================================================================
-- 3. RPC: create_friend_invite
--
-- Creates a new invite token for the current user.
-- Returns the full friend_invites row (including the generated token).
-- =============================================================================

create or replace function public.create_friend_invite()
returns public.friend_invites
language plpgsql
security definer as $$
declare
  v_invite public.friend_invites;
  v_uid    uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  insert into public.friend_invites (inviter_id)
  values (v_uid)
  returning * into v_invite;

  return v_invite;
end;
$$;


-- =============================================================================
-- 4. RPC: accept_friend_invite
--
-- Validates an invite token and creates an accepted friendship.
-- Single-use: marks the token as used after acceptance.
--
-- Error codes:
--   P0001 — not authenticated
--   P0002 — invite not found, already used, or expired
--   P0003 — cannot friend yourself
--   P0004 — already friends
-- =============================================================================

create or replace function public.accept_friend_invite(p_token text)
returns public.friendships
language plpgsql
security definer as $$
declare
  v_invite     public.friend_invites;
  v_friendship public.friendships;
  v_uid        uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  -- 1. Find a valid (unused, not expired) invite
  select * into v_invite
  from public.friend_invites
  where token = p_token
    and used_by is null
    and expires_at > now();

  if v_invite is null then
    raise exception 'Invite not found, already used, or expired'
      using errcode = 'P0002';
  end if;

  -- 2. Cannot friend yourself
  if v_invite.inviter_id = v_uid then
    raise exception 'Cannot add yourself as a friend'
      using errcode = 'P0003';
  end if;

  -- 3. Check if already friends
  if exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(v_invite.inviter_id, v_uid)
      and greatest(requester_id, addressee_id) = greatest(v_invite.inviter_id, v_uid)
  ) then
    raise exception 'Already friends'
      using errcode = 'P0004';
  end if;

  -- 4. Create accepted friendship
  insert into public.friendships (requester_id, addressee_id, status)
  values (v_invite.inviter_id, v_uid, 'accepted')
  returning * into v_friendship;

  -- 5. Mark invite as used
  update public.friend_invites
  set used_by = v_uid
  where id = v_invite.id;

  return v_friendship;
end;
$$;


-- =============================================================================
-- 5. RPC: search_user_by_email
--
-- Finds a registered user by exact email match (case-insensitive).
-- Uses SECURITY DEFINER to access auth.users (not queryable via RLS).
-- Excludes the calling user from results.
-- =============================================================================

create or replace function public.search_user_by_email(p_email text)
returns table(user_id uuid, display_name text, email text)
language plpgsql
security definer as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  return query
  select u.id as user_id, p.display_name, u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(p_email)
    and u.id <> auth.uid();
end;
$$;


-- =============================================================================
-- 6. RPC: add_friend_by_id
--
-- Creates an accepted friendship directly (for email search flow).
-- Handles self-add and duplicate friendship cases.
--
-- Error codes:
--   P0001 — not authenticated
--   P0003 — cannot friend yourself
--   P0004 — already friends (caught via unique index)
-- =============================================================================

create or replace function public.add_friend_by_id(p_friend_id uuid)
returns public.friendships
language plpgsql
security definer as $$
declare
  v_friendship public.friendships;
  v_uid        uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  if p_friend_id = v_uid then
    raise exception 'Cannot add yourself as a friend'
      using errcode = 'P0003';
  end if;

  -- Check if already friends
  if exists (
    select 1 from public.friendships
    where least(requester_id, addressee_id) = least(v_uid, p_friend_id)
      and greatest(requester_id, addressee_id) = greatest(v_uid, p_friend_id)
  ) then
    raise exception 'Already friends'
      using errcode = 'P0004';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_uid, p_friend_id, 'accepted')
  returning * into v_friendship;

  return v_friendship;
end;
$$;
