-- =============================================================================
-- 0007_group_invites.sql
--
-- Adds multi-use shareable invite links for groups.
-- A single token is valid for 7 days and can be used by multiple people.
-- Accepting adds the invitee to the group AND creates a friendship with the
-- token creator (idempotent — skips silently if already a member / already friends).
-- =============================================================================


-- =============================================================================
-- 1. TABLE
-- =============================================================================

create table public.group_invites (
  id         uuid        primary key default gen_random_uuid(),
  token      text        not null unique default public.generate_short_token(),
  group_id   uuid        not null references public.groups(id) on delete cascade,
  created_by uuid        not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_group_invites_group on public.group_invites (group_id, created_at desc);


-- =============================================================================
-- 2. RLS
-- =============================================================================

alter table public.group_invites enable row level security;

-- Only group members can view invite tokens for their groups.
drop policy if exists "group_invites: members can select" on public.group_invites;
create policy "group_invites: members can select"
  on public.group_invites for select
  using (public.is_group_member(group_id));

-- Any group member can create an invite link; created_by must be the caller.
drop policy if exists "group_invites: members can insert" on public.group_invites;
create policy "group_invites: members can insert"
  on public.group_invites for insert
  with check (
    created_by = auth.uid()
    and public.is_group_member(group_id)
  );

-- Only the creator can revoke their token (set revoked_at).
drop policy if exists "group_invites: creator can update" on public.group_invites;
create policy "group_invites: creator can update"
  on public.group_invites for update
  using (created_by = auth.uid());


-- =============================================================================
-- 3. RPC: create_group_invite
--
-- Returns the token for sharing. Always creates a new token (multi-use tokens
-- are all valid simultaneously; the app shows the most recent one).
-- The caller must be a group member (enforced by RLS on the INSERT).
-- =============================================================================

create or replace function public.create_group_invite(p_group_id uuid)
returns public.group_invites
language plpgsql
security definer as $$
declare
  v_row public.group_invites;
  v_uid uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group' using errcode = 'P0002';
  end if;

  -- Return an existing active token if one was created by this user
  -- (avoids creating a new token every time the share sheet is opened).
  select * into v_row
  from public.group_invites
  where group_id   = p_group_id
    and created_by = v_uid
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_row.id is not null then
    return v_row;
  end if;

  -- No active token — create one.
  insert into public.group_invites (group_id, created_by)
  values (p_group_id, v_uid)
  returning * into v_row;

  return v_row;
end;
$$;


-- =============================================================================
-- 4. RPC: accept_group_invite
--
-- Atomic acceptance:
--   1. Validate token (exists, not expired, not revoked)
--   2. If caller is already a member → idempotent return of group_id
--   3. Add caller to group_members + write member_joined event
--   4. Create friendship between caller and token creator (skip if exists)
--
-- Returns the group_id so the app can navigate to the group detail page.
-- Callable by any authenticated user — the token IS the authorization.
-- =============================================================================

create or replace function public.accept_group_invite(p_token text)
returns uuid
language plpgsql
security definer as $$
declare
  v_invite   public.group_invites;
  v_uid      uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  -- 1. Find a valid (not expired, not revoked) token.
  select * into v_invite
  from public.group_invites
  where token      = p_token
    and revoked_at is null
    and expires_at > now();

  if v_invite.id is null then
    raise exception 'Invite not found, expired, or revoked' using errcode = 'P0002';
  end if;

  -- 2. Idempotent: already a member → just return the group_id.
  if exists (
    select 1 from public.group_members
    where group_id = v_invite.group_id
      and user_id  = v_uid
  ) then
    return v_invite.group_id;
  end if;

  -- 3. Add to group and record the event (mirrors add_member_with_event but
  --    bypasses the "caller must already be a member" guard of that RPC).
  insert into public.group_members (group_id, user_id)
  values (v_invite.group_id, v_uid);

  insert into public.group_events (group_id, user_id, event_type, metadata)
  values (v_invite.group_id, v_uid, 'member_joined', '{"via": "invite"}'::jsonb);

  -- 4. Create friendship between invitee and invite creator.
  --    ON CONFLICT handles the case where they are already friends
  --    (the unordered unique index prevents duplicate (A,B)/(B,A) pairs).
  if v_invite.created_by <> v_uid then
    insert into public.friendships (requester_id, addressee_id, status)
    values (v_invite.created_by, v_uid, 'accepted')
    on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
    do nothing;
  end if;

  return v_invite.group_id;
end;
$$;
