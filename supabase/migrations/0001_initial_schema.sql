-- =============================================================================
-- Migration: 0001_initial_schema
-- Description: Full initial schema for 50Pfennig
--
-- Tables:    groups, group_members, expenses, expense_splits, settlements
-- RLS:       Enabled on all tables. Access restricted to group members.
-- Functions: is_group_member() helper, create_expense() RPC, update_expense() RPC
-- Indexes:   On all foreign key columns used in common queries
--
-- Key design decisions:
--   - All monetary amounts stored as INTEGER (cents). No DECIMAL/NUMERIC.
--   - Balances are NEVER stored — always computed from expense_splits + settlements.
--   - expense_splits stores the computed split snapshot (not re-derived at read time).
--   - Expense + splits are written atomically via the create_expense() function.
--
-- See: docs/adr/0003-integer-cents-for-money.md
--      docs/adr/0006-atomic-expense-creation-via-rpc.md
--      docs/adr/0007-expense-splits-as-snapshot.md
--      docs/adr/0009-balances-never-stored.md
-- =============================================================================


-- =============================================================================
-- TABLES
-- =============================================================================

create table public.groups (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null check (char_length(name) between 1 and 100),
  created_by uuid        not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  group_id     uuid        not null references public.groups(id) on delete cascade,
  display_name text        not null check (char_length(display_name) between 1 and 80),
  joined_at    timestamptz not null default now(),
  primary key (user_id, group_id)
);

create table public.expenses (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        not null references public.groups(id) on delete cascade,
  description  text        not null check (char_length(description) between 1 and 200),
  total_amount integer     not null check (total_amount > 0),  -- cents
  paid_by      uuid        not null references auth.users(id),
  split_type   text        not null check (split_type in ('equal', 'exact', 'percentage')),
  split_config jsonb       not null default '{}', -- full discriminated union (for audit trail)
  created_by   uuid        not null references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Stores the SNAPSHOT of the split algorithm output at write time.
-- This is immutable financial history — not derived state.
-- See ADR-0007.
create table public.expense_splits (
  id         uuid    primary key default gen_random_uuid(),
  expense_id uuid    not null references public.expenses(id) on delete cascade,
  user_id    uuid    not null references auth.users(id),
  amount     integer not null check (amount >= 0), -- cents, this user's share
  unique (expense_id, user_id)
);

create table public.settlements (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        not null references public.groups(id) on delete cascade,
  from_user_id uuid        not null references auth.users(id), -- who paid
  to_user_id   uuid        not null references auth.users(id), -- who received
  amount       integer     not null check (amount > 0),        -- cents
  note         text,
  created_at   timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);


-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_group_members_user_id   on public.group_members(user_id);
create index idx_group_members_group_id  on public.group_members(group_id);
create index idx_expenses_group_id       on public.expenses(group_id);
create index idx_expenses_paid_by        on public.expenses(paid_by);
create index idx_expense_splits_expense  on public.expense_splits(expense_id);
create index idx_expense_splits_user     on public.expense_splits(user_id);
create index idx_settlements_group_id    on public.settlements(group_id);
create index idx_settlements_from_user   on public.settlements(from_user_id);
create index idx_settlements_to_user     on public.settlements(to_user_id);


-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute procedure public.handle_updated_at();


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements    enable row level security;

-- Helper: is the current user a member of a given group?
--
-- Uses SECURITY DEFINER so this function executes with the privileges of its
-- owner (postgres), bypassing RLS on group_members for the membership check
-- itself. This avoids infinite RLS recursion. The function is read-only and
-- simple enough to audit easily. See ADR-0001.
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


-- ---------------------------------------------------------------------------
-- groups policies
-- ---------------------------------------------------------------------------

create policy "groups: members can view"
  on public.groups for select
  using (public.is_group_member(id));

create policy "groups: authenticated users can create"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "groups: creator can update"
  on public.groups for update
  using (auth.uid() = created_by);

-- Intentionally no DELETE policy on groups in V1.
-- Groups accumulate financial history; deletion requires careful cleanup.


-- ---------------------------------------------------------------------------
-- group_members policies
-- ---------------------------------------------------------------------------

create policy "group_members: members can view"
  on public.group_members for select
  using (public.is_group_member(group_id));

create policy "group_members: members can add others"
  on public.group_members for insert
  with check (public.is_group_member(group_id));

create policy "group_members: users can remove themselves"
  on public.group_members for delete
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- expenses policies
-- ---------------------------------------------------------------------------

create policy "expenses: members can view"
  on public.expenses for select
  using (public.is_group_member(group_id));

create policy "expenses: members can create"
  on public.expenses for insert
  with check (
    public.is_group_member(group_id)
    and auth.uid() = created_by
  );

create policy "expenses: creator can update"
  on public.expenses for update
  using (auth.uid() = created_by);

create policy "expenses: creator can delete"
  on public.expenses for delete
  using (auth.uid() = created_by);


-- ---------------------------------------------------------------------------
-- expense_splits policies
--
-- Splits are never written directly by the client — they are always
-- managed by the create_expense / update_expense RPC functions.
-- The insert policy here is a defence-in-depth guard only.
-- ---------------------------------------------------------------------------

create policy "expense_splits: group members can view"
  on public.expense_splits for select
  using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_id
        and public.is_group_member(e.group_id)
    )
  );

create policy "expense_splits: only expense creator can insert"
  on public.expense_splits for insert
  with check (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_id
        and e.created_by = auth.uid()
    )
  );

create policy "expense_splits: only expense creator can delete"
  on public.expense_splits for delete
  using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_id
        and e.created_by = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- settlements policies
-- ---------------------------------------------------------------------------

create policy "settlements: members can view"
  on public.settlements for select
  using (public.is_group_member(group_id));

create policy "settlements: members can create their own"
  on public.settlements for insert
  with check (
    public.is_group_member(group_id)
    and auth.uid() = from_user_id
  );

create policy "settlements: creator can delete"
  on public.settlements for delete
  using (auth.uid() = from_user_id);


-- =============================================================================
-- RPC: create_expense
--
-- Inserts an expense row and all its split rows atomically in one transaction.
-- The client MUST call this function instead of inserting into both tables
-- separately. See ADR-0006.
--
-- p_splits format: [{"user_id": "<uuid>", "amount": <integer cents>}, ...]
--
-- Validations:
--   1. Caller must be a member of the group
--   2. Sum of split amounts must equal total_amount exactly
--
-- Usage from TypeScript:
--   supabase.rpc('create_expense', { p_group_id: ..., p_splits: [...] })
-- =============================================================================

create or replace function public.create_expense(
  p_group_id     uuid,
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
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group'
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


-- =============================================================================
-- RPC: update_expense
--
-- Updates an expense and atomically replaces all its splits.
-- Deletes existing splits and inserts the new set in the same transaction.
-- See ADR-0006 and ADR-0007.
-- =============================================================================

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
