-- =============================================================================
-- 0002_group_events.sql
--
-- Adds an extensible event log table for group lifecycle events (member
-- joined, member left, etc.). This enables the activity feed on
-- GroupDetailPage to show membership changes alongside expenses and
-- settlements.
--
-- Design decisions:
--   - event_type is an unconstrained text column so new event types can be
--     added without schema changes (extensible by convention).
--   - metadata jsonb column holds event-specific payload for future use.
--   - RLS: current members can read all events; any user can read events
--     they personally generated (covers the case where a user left the group
--     and no longer has a group_members row).
--   - leave_group() RPC removes the group_members row and writes a
--     'member_left' event atomically.
--   - add_member_with_event() RPC inserts into group_members and writes a
--     'member_joined' event atomically. Replaces the raw insert in the
--     client-side addMember flow.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE
-- ---------------------------------------------------------------------------

create table public.group_events (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups(id) on delete cascade,
  user_id    uuid        not null references auth.users(id),
  event_type text        not null,   -- 'member_joined' | 'member_left' | future types
  metadata   jsonb       not null default '{}',
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

create index idx_group_events_group on public.group_events(group_id, created_at desc);
create index idx_group_events_user  on public.group_events(user_id);


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.group_events enable row level security;

-- Current members can read all events for their group.
-- Former members (who left) can still read events they personally generated.
create policy "group_events: members can view"
  on public.group_events for select
  using (
    public.is_group_member(group_id)
    or user_id = auth.uid()
  );

-- Users can only insert events for themselves.
create policy "group_events: users can insert own"
  on public.group_events for insert
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- RPC: leave_group
--
-- Atomically removes the caller from group_members and writes a
-- 'member_left' event. Raises an error if the caller is not a member.
-- ---------------------------------------------------------------------------

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  -- Remove membership
  delete from public.group_members
  where group_id = p_group_id
    and user_id  = auth.uid();

  if not found then
    raise exception 'Not a member of this group' using errcode = 'P0001';
  end if;

  -- Record the leave event
  insert into public.group_events (group_id, user_id, event_type)
  values (p_group_id, auth.uid(), 'member_left');
end;
$$;


-- ---------------------------------------------------------------------------
-- RPC: add_member_with_event
--
-- Atomically inserts a user into group_members and writes a 'member_joined'
-- event. Can only be called by an existing group member (SECURITY DEFINER
-- runs as the function owner but auth.uid() is still the caller).
-- ---------------------------------------------------------------------------

create or replace function public.add_member_with_event(
  p_group_id uuid,
  p_user_id  uuid
)
returns public.group_members
language plpgsql
security definer as $$
declare
  v_row public.group_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group' using errcode = 'P0001';
  end if;

  -- Add the new member
  insert into public.group_members (group_id, user_id)
  values (p_group_id, p_user_id)
  returning * into v_row;

  -- Record the join event (attributed to the new member, not the adder)
  insert into public.group_events (group_id, user_id, event_type)
  values (p_group_id, p_user_id, 'member_joined');

  return v_row;
end;
$$;
