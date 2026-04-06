-- -----------------------------------------------------------------------------
-- 0008_multi_use_friend_invites.sql
--
-- Makes friend invite links multi-use.
--
-- Changes:
--   1. Drop the `used_by` column from friend_invites — no longer meaningful
--      when multiple users can accept the same token.
--   2. Replace accept_friend_invite() to:
--      - Remove the `used_by IS NULL` single-use check
--      - Remove the UPDATE that marked the token as used
--      - Make "already friends" idempotent (return existing friendship row)
--        instead of raising P0004, consistent with group invite behaviour
-- -----------------------------------------------------------------------------

alter table public.friend_invites
  drop column if exists used_by;


-- -----------------------------------------------------------------------------
-- accept_friend_invite (multi-use replacement)
--
-- Validates an invite token and creates an accepted friendship.
-- Multi-use: token remains valid until it expires.
-- Idempotent: if the caller is already friends with the inviter, returns the
-- existing friendship row without error.
--
-- Error codes:
--   P0001 — not authenticated
--   P0002 — invite not found or expired
--   P0003 — cannot friend yourself
-- -----------------------------------------------------------------------------

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

  -- 1. Find a valid (not expired) invite — no longer checks used_by
  select * into v_invite
  from public.friend_invites
  where token      = p_token
    and expires_at > now();

  if v_invite is null then
    raise exception 'Invite not found or expired'
      using errcode = 'P0002';
  end if;

  -- 2. Cannot friend yourself
  if v_invite.inviter_id = v_uid then
    raise exception 'Cannot add yourself as a friend'
      using errcode = 'P0003';
  end if;

  -- 3. Already friends → idempotent return (no error)
  select * into v_friendship
  from public.friendships
  where status = 'accepted'
    and least(requester_id, addressee_id)    = least(v_invite.inviter_id, v_uid)
    and greatest(requester_id, addressee_id) = greatest(v_invite.inviter_id, v_uid);

  if v_friendship is not null then
    return v_friendship;
  end if;

  -- 4. Create accepted friendship
  insert into public.friendships (requester_id, addressee_id, status)
  values (v_invite.inviter_id, v_uid, 'accepted')
  returning * into v_friendship;

  return v_friendship;
end;
$$;
