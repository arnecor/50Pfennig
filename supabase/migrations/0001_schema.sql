-- =============================================================================
-- 50Pfennig — Canonical Schema
-- =============================================================================
-- Single squashed migration representing the full net state of the database.
--
-- Sections:
--   1.  Extensions
--   2.  Trigger functions  (plpgsql — table refs resolved at runtime)
--   3.  Tables
--   4.  Indexes
--   5.  RLS helper functions  (language sql — must follow tables)
--   6.  Row Level Security
--   7.  Triggers
--   8.  RPC functions
--
-- Key design decisions:
--   - All monetary amounts stored as INTEGER (cents). No DECIMAL/NUMERIC.
--   - Balances are NEVER stored — always computed from expense_splits + settlements.
--   - expense_splits stores the computed split snapshot (immutable financial history).
--   - Expense + splits are written atomically via create_expense() / update_expense() RPCs.
--   - Group creation is atomic via create_group() RPC (SECURITY DEFINER, bypasses RLS).
--   - expenses.group_id IS NULL  ⇒ friend expense; IS NOT NULL ⇒ group expense.
--   - settlements.group_id follows the same nullable convention.
--   - Batch settlements (ADR-0012): multiple settlement rows share a batch_id.
--   - Friendship is one row per pair (unordered unique index prevents duplicates).
--   - Push notifications use Supabase Database Webhooks (configured in Dashboard).
--
-- See docs/adr/ for full Architecture Decision Records.
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;


-- =============================================================================
-- 2. TRIGGER FUNCTIONS
-- (defined early so trigger declarations in section 6 can reference them)
-- =============================================================================

-- Automatically bump updated_at on every UPDATE.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- Auto-create a profile row when a new auth user signs up.
-- plpgsql: table references are resolved at runtime, so this can be defined
-- before the profiles table exists.
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


-- =============================================================================
-- 3. TABLES
-- (in FK dependency order: profiles → groups → group_members → friendships
--  → friend_invites → expenses → expense_splits → settlements → push_tokens)
-- =============================================================================

-- Canonical display name for every user.
-- group_members.user_id references this table (not auth.users directly) so
-- the Supabase JS client can resolve .profiles(display_name) via PostgREST.
create table public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  display_name text        not null default '' check (char_length(display_name) <= 80),
  updated_at   timestamptz not null default now()
);


create table public.groups (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null check (char_length(name) between 1 and 100),
  created_by uuid        not null references auth.users(id),
  created_at timestamptz not null default now()
);


-- display_name is sourced from profiles — not stored here.
create table public.group_members (
  user_id   uuid        not null references public.profiles(id) on delete cascade,
  group_id  uuid        not null references public.groups(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, group_id)
);


-- One row per accepted friendship.
-- requester_id / addressee_id preserved for future invite flows.
-- status = 'accepted' | 'pending' — 'pending' reserved for future invite flow.
-- Unordered unique index prevents both (A→B) and (B→A) from coexisting.
create table public.friendships (
  id           uuid        primary key default gen_random_uuid(),
  requester_id uuid        not null references public.profiles(id) on delete cascade,
  addressee_id uuid        not null references public.profiles(id) on delete cascade,
  status       text        not null default 'accepted'
               check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id)
);


-- Single-use invite tokens for adding friends via link or email search.
-- Tokens expire after 7 days. used_by is set on acceptance.
create table public.friend_invites (
  id         uuid        primary key default gen_random_uuid(),
  token      text        not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  inviter_id uuid        not null references public.profiles(id) on delete cascade,
  used_by    uuid        references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);


-- group_id IS NULL  → friend expense (not tied to any group)
-- group_id IS NOT NULL → group expense
-- split_config stores the full discriminated union as an audit trail.
create table public.expenses (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        references public.groups(id) on delete cascade, -- nullable
  description  text        not null check (char_length(description) between 1 and 200),
  total_amount integer     not null check (total_amount > 0),  -- cents
  paid_by      uuid        not null references auth.users(id),
  split_type   text        not null check (split_type in ('equal', 'exact', 'percentage')),
  split_config jsonb       not null default '{}',
  created_by   uuid        not null references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);


-- Immutable snapshot of the split algorithm output at write time.
-- Never re-derived at read time. See ADR-0007.
-- Invariant: sum(amount) per expense_id = expenses.total_amount
create table public.expense_splits (
  id         uuid    primary key default gen_random_uuid(),
  expense_id uuid    not null references public.expenses(id) on delete cascade,
  user_id    uuid    not null references auth.users(id),
  amount     integer not null check (amount >= 0), -- cents, this user's share
  unique (expense_id, user_id)
);


-- group_id IS NULL → friend settlement
-- group_id IS NOT NULL → group settlement
-- batch_id links records from a single real-world payment across multiple
-- accounting contexts (ADR-0012).
create table public.settlements (
  id           uuid        primary key default gen_random_uuid(),
  batch_id     uuid,                                              -- nullable; set when part of a batch
  group_id     uuid        references public.groups(id) on delete cascade, -- nullable
  from_user_id uuid        not null references auth.users(id),   -- who paid
  to_user_id   uuid        not null references auth.users(id),   -- who received
  amount       integer     not null check (amount > 0),          -- cents
  note         text,
  created_at   timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);


-- FCM / APNs registration tokens per user per device.
-- Triggers for push delivery are handled by Supabase Database Webhooks
-- (configured in Dashboard → Database → Webhooks), not pg_net triggers.
create table public.push_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  token      text        not null,
  platform   text        not null default 'android'
             check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);


-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- group_members
create index idx_group_members_user_id  on public.group_members(user_id);
create index idx_group_members_group_id on public.group_members(group_id);

-- friendships
create unique index friendships_unordered_unique
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );
create index idx_friendships_requester on public.friendships(requester_id);
create index idx_friendships_addressee on public.friendships(addressee_id);

-- friend_invites
create index idx_friend_invites_token   on public.friend_invites(token);
create index idx_friend_invites_inviter on public.friend_invites(inviter_id);

-- expenses
create index idx_expenses_group_id on public.expenses(group_id);
create index idx_expenses_paid_by  on public.expenses(paid_by);

-- expense_splits
create index idx_expense_splits_expense on public.expense_splits(expense_id);
create index idx_expense_splits_user    on public.expense_splits(user_id);

-- settlements
create index idx_settlements_group_id  on public.settlements(group_id);
create index idx_settlements_from_user on public.settlements(from_user_id);
create index idx_settlements_to_user   on public.settlements(to_user_id);
create index idx_settlements_batch_id  on public.settlements(batch_id);

-- push_tokens
create index idx_push_tokens_user_id on public.push_tokens(user_id);


-- =============================================================================
-- 5. RLS HELPER FUNCTIONS
-- (defined after tables so `language sql` bodies can resolve table references)
-- =============================================================================

-- Returns true if auth.uid() is a member of the given group.
-- SECURITY DEFINER so it bypasses RLS on group_members, preventing infinite
-- recursion when called from RLS policies. See ADR-0001.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable as $$
  select exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id  = auth.uid()
  );
$$;


-- Returns true if auth.uid() can access the given expense (as group member,
-- payer, or split participant). SECURITY DEFINER to break the circular RLS
-- dependency between expenses and expense_splits. See ADR-0004.
create or replace function public.can_access_expense(p_expense_id uuid)
returns boolean
language sql
security definer
stable as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and (
        -- Group expense: caller must be a member of the group
        (e.group_id is not null and public.is_group_member(e.group_id))
        or
        -- Friend expense: caller must be the payer or a split participant
        (e.group_id is null and (
          e.paid_by = auth.uid()
          or exists (
            select 1 from public.expense_splits es
            where es.expense_id = p_expense_id
              and es.user_id    = auth.uid()
          )
        ))
      )
  );
$$;


-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.friendships   enable row level security;
alter table public.friend_invites enable row level security;
alter table public.expenses      enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements   enable row level security;
alter table public.push_tokens   enable row level security;


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Any authenticated user can read all profiles (needed for group member names).
create policy "profiles: authenticated users can read"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "profiles: users can update own"
  on public.profiles for update
  using (auth.uid() = id);


-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------

create policy "groups: members can view"
  on public.groups for select
  using (public.is_group_member(id));

-- Defence-in-depth only — the real write path is create_group() RPC.
create policy "groups: authenticated users can create"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "groups: creator can update"
  on public.groups for update
  using (auth.uid() = created_by);

-- No DELETE policy on groups: groups accumulate financial history.


-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------

create policy "group_members: members can view"
  on public.group_members for select
  using (public.is_group_member(group_id));

-- Defence-in-depth only — the real write path is create_group() RPC.
create policy "group_members: members can add others"
  on public.group_members for insert
  with check (public.is_group_member(group_id));

create policy "group_members: users can remove themselves"
  on public.group_members for delete
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------

create policy "friendships: users can view own"
  on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "friendships: users can create as requester"
  on public.friendships for insert
  with check (requester_id = auth.uid());

-- Addressee can update status (accept/decline) — reserved for future invite flow.
create policy "friendships: addressee can update status"
  on public.friendships for update
  using (addressee_id = auth.uid());

create policy "friendships: participants can delete"
  on public.friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());


-- ---------------------------------------------------------------------------
-- friend_invites
-- ---------------------------------------------------------------------------

-- Any authenticated user can read invites (needed for token lookup during accept).
create policy "friend_invites: authenticated can view"
  on public.friend_invites for select
  using (auth.uid() is not null);

create policy "friend_invites: users can create own"
  on public.friend_invites for insert
  with check (inviter_id = auth.uid());


-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------

-- Delegates to can_access_expense() to avoid circular RLS recursion with
-- expense_splits. See ADR-0004.
create policy "expenses: members and participants can view"
  on public.expenses for select
  using (public.can_access_expense(id));

-- Defence-in-depth — the real write path is create_expense() RPC.
create policy "expenses: members can create"
  on public.expenses for insert
  with check (
    auth.uid() = created_by
    and (
      (group_id is not null and public.is_group_member(group_id))
      or group_id is null
    )
  );

create policy "expenses: creator can update"
  on public.expenses for update
  using (auth.uid() = created_by);

create policy "expenses: creator can delete"
  on public.expenses for delete
  using (auth.uid() = created_by);


-- ---------------------------------------------------------------------------
-- expense_splits
-- (never written directly by the client — always via create_expense / update_expense)
-- ---------------------------------------------------------------------------

create policy "expense_splits: participants can view"
  on public.expense_splits for select
  using (public.can_access_expense(expense_id));

create policy "expense_splits: only expense creator can insert"
  on public.expense_splits for insert
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and e.created_by = auth.uid()
    )
  );

create policy "expense_splits: only expense creator can delete"
  on public.expense_splits for delete
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and e.created_by = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------

create policy "settlements: participants can view"
  on public.settlements for select
  using (
    (group_id is not null and public.is_group_member(group_id))
    or
    (group_id is null and (
      from_user_id = auth.uid()
      or to_user_id = auth.uid()
    ))
  );

-- Defence-in-depth — the real write path is create_settlement_batch() RPC.
create policy "settlements: participants can create"
  on public.settlements for insert
  with check (
    auth.uid() = from_user_id
    and (
      (group_id is not null and public.is_group_member(group_id))
      or group_id is null
    )
  );

create policy "settlements: creator can delete"
  on public.settlements for delete
  using (auth.uid() = from_user_id);


-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------

create policy "push_tokens: users manage own"
  on public.push_tokens
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());


-- =============================================================================
-- 7. TRIGGERS
-- =============================================================================

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute procedure public.handle_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 8. RPC FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_group
--
-- Creates a group and adds the creator + optional extra members atomically.
-- SECURITY DEFINER bypasses RLS so the strict member-only policies on groups
-- and group_members don't block the initial insert. See ADR-0013.
--
-- Parameters:
--   p_name        — display name for the group (1–100 chars)
--   p_member_ids  — optional UUIDs of additional members to add (beyond creator)
--
-- Returns: the newly inserted groups row
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- create_expense
--
-- Inserts an expense row and all its split rows atomically.
-- p_group_id is nullable: NULL = friend expense, set = group expense.
-- See ADR-0006.
--
-- p_splits format: [{"user_id": "<uuid>", "amount": <integer cents>}, ...]
--
-- Validations:
--   1. Caller must be authenticated (friend) or a group member (group)
--   2. Sum of split amounts must equal total_amount exactly
-- -----------------------------------------------------------------------------

create or replace function public.create_expense(
  p_group_id     uuid,      -- NULL for friend expenses
  p_description  text,
  p_total_amount integer,
  p_paid_by      uuid,
  p_split_type   text,
  p_split_config jsonb,
  p_splits       jsonb
)
returns public.expenses
language plpgsql
security definer as $$
declare
  v_expense public.expenses;
  v_split   jsonb;
  v_sum     integer;
begin
  -- 1. Authorization
  if p_group_id is not null and not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group'
      using errcode = 'P0001';
  end if;

  if p_group_id is null and auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  -- 2. Validate: splits must sum exactly to total
  select coalesce(sum((s->>'amount')::integer), 0)
  into   v_sum
  from   jsonb_array_elements(p_splits) s;

  if v_sum <> p_total_amount then
    raise exception 'Splits sum (%) does not equal total_amount (%)',
      v_sum, p_total_amount
      using errcode = 'P0002';
  end if;

  -- 3. Insert expense
  insert into public.expenses (
    group_id, description, total_amount,
    paid_by, split_type, split_config, created_by
  ) values (
    p_group_id, p_description, p_total_amount,
    p_paid_by, p_split_type, p_split_config, auth.uid()
  )
  returning * into v_expense;

  -- 4. Insert splits
  for v_split in select * from jsonb_array_elements(p_splits) loop
    insert into public.expense_splits (expense_id, user_id, amount)
    values (
      v_expense.id,
      (v_split->>'user_id')::uuid,
      (v_split->>'amount')::integer
    );
  end loop;

  return v_expense;
end;
$$;


-- -----------------------------------------------------------------------------
-- update_expense
--
-- Updates an expense and atomically replaces all its splits.
-- Deletes existing splits and inserts the new set in the same transaction.
-- See ADR-0006 and ADR-0007.
-- -----------------------------------------------------------------------------

create or replace function public.update_expense(
  p_expense_id   uuid,
  p_description  text,
  p_total_amount integer,
  p_paid_by      uuid,
  p_split_type   text,
  p_split_config jsonb,
  p_splits       jsonb
)
returns public.expenses
language plpgsql
security definer as $$
declare
  v_expense public.expenses;
  v_split   jsonb;
  v_sum     integer;
begin
  -- 1. Authorization: only the original creator can update
  if not exists (
    select 1 from public.expenses
    where id = p_expense_id and created_by = auth.uid()
  ) then
    raise exception 'Expense not found or not authorized'
      using errcode = 'P0001';
  end if;

  -- 2. Validate: splits must sum exactly to total
  select coalesce(sum((s->>'amount')::integer), 0)
  into   v_sum
  from   jsonb_array_elements(p_splits) s;

  if v_sum <> p_total_amount then
    raise exception 'Splits sum (%) does not equal total_amount (%)',
      v_sum, p_total_amount
      using errcode = 'P0002';
  end if;

  -- 3. Update expense (updated_at is handled by the trigger)
  update public.expenses set
    description  = p_description,
    total_amount = p_total_amount,
    paid_by      = p_paid_by,
    split_type   = p_split_type,
    split_config = p_split_config
  where id = p_expense_id
  returning * into v_expense;

  -- 4. Replace splits: delete old, insert new — all in this transaction
  delete from public.expense_splits
  where expense_id = p_expense_id;

  for v_split in select * from jsonb_array_elements(p_splits) loop
    insert into public.expense_splits (expense_id, user_id, amount)
    values (
      v_expense.id,
      (v_split->>'user_id')::uuid,
      (v_split->>'amount')::integer
    );
  end loop;

  return v_expense;
end;
$$;


-- -----------------------------------------------------------------------------
-- create_friend_invite
--
-- Creates a new invite token for the current user.
-- Returns the full friend_invites row (including the generated token).
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- accept_friend_invite
--
-- Validates an invite token and creates an accepted friendship.
-- Single-use: marks the token as used after acceptance.
--
-- Error codes:
--   P0001 — not authenticated
--   P0002 — invite not found, already used, or expired
--   P0003 — cannot friend yourself
--   P0004 — already friends
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
      and least(requester_id, addressee_id)    = least(v_invite.inviter_id, v_uid)
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


-- -----------------------------------------------------------------------------
-- search_user_by_email
--
-- Finds a registered user by exact email match (case-insensitive).
-- SECURITY DEFINER to access auth.users (not queryable via RLS).
-- Excludes the calling user from results.
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- add_friend_by_id
--
-- Creates an accepted friendship directly (for email search flow).
--
-- Error codes:
--   P0001 — not authenticated
--   P0003 — cannot friend yourself
--   P0004 — already friends
-- -----------------------------------------------------------------------------

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

  if exists (
    select 1 from public.friendships
    where least(requester_id, addressee_id)    = least(v_uid, p_friend_id)
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


-- -----------------------------------------------------------------------------
-- create_settlement_batch
--
-- Atomically inserts one settlement record per allocation.
-- All records share the same batch_id, note, and created_at.
-- See ADR-0012.
--
-- p_allocations format:
--   [{"group_id": uuid|null, "amount": int, "from_user_id": uuid, "to_user_id": uuid}, ...]
--
-- Returns: the shared batch_id (uuid)
-- -----------------------------------------------------------------------------

create or replace function public.create_settlement_batch(
  p_from_user_id uuid,
  p_to_user_id   uuid,
  p_note         text,
  p_allocations  jsonb
)
returns uuid
language plpgsql
security definer as $$
declare
  v_batch_id   uuid := gen_random_uuid();
  v_alloc      jsonb;
  v_alloc_from uuid;
  v_alloc_to   uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if auth.uid() <> p_from_user_id then
    raise exception 'You can only record settlements you sent'
      using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one allocation is required'
      using errcode = 'P0002';
  end if;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_alloc_from := (v_alloc->>'from_user_id')::uuid;
    v_alloc_to   := (v_alloc->>'to_user_id')::uuid;

    if v_alloc_from = v_alloc_to then
      raise exception 'from_user_id and to_user_id must differ'
        using errcode = 'P0002';
    end if;

    if (v_alloc->>'amount')::integer <= 0 then
      raise exception 'Settlement amount must be positive'
        using errcode = 'P0002';
    end if;

    if v_alloc->>'group_id' is not null and (v_alloc->>'group_id')::uuid is not null then
      if not public.is_group_member((v_alloc->>'group_id')::uuid) then
        raise exception 'Not a member of group %', v_alloc->>'group_id'
          using errcode = 'P0001';
      end if;
    end if;

    insert into public.settlements (
      batch_id, group_id, from_user_id, to_user_id, amount, note
    ) values (
      v_batch_id,
      case when v_alloc->>'group_id' is not null
           then (v_alloc->>'group_id')::uuid
           else null end,
      v_alloc_from,
      v_alloc_to,
      (v_alloc->>'amount')::integer,
      p_note
    );
  end loop;

  return v_batch_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- delete_settlement_batch
--
-- Deletes all settlement records in a batch atomically.
-- Only the original from_user (the person who paid) can delete.
-- See ADR-0012.
-- -----------------------------------------------------------------------------

create or replace function public.delete_settlement_batch(p_batch_id uuid)
returns void
language plpgsql
security definer as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.settlements
    where batch_id = p_batch_id
      and from_user_id = auth.uid()
  ) then
    raise exception 'You can only delete settlements you initiated'
      using errcode = 'P0001';
  end if;

  delete from public.settlements
  where batch_id = p_batch_id;
end;
$$;
