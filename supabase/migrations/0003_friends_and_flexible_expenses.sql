-- =============================================================================
-- Migration: 0003_friends_and_flexible_expenses
-- Description: Introduce friendships and decouple expenses from groups
--
-- Changes:
--   1. New table: friendships (requester, addressee, status)
--   2. expenses.group_id  → nullable (friend expenses have no group)
--   3. settlements.group_id → nullable (friend settlements have no group)
--   4. Updated RLS on expenses and expense_splits to handle nullable group_id
--   5. Updated RLS on settlements to handle nullable group_id
--   6. New RLS policies on friendships
--   7. Updated create_expense() RPC to accept nullable p_group_id
--
-- Key design decisions:
--   - Friendship is stored as ONE row per pair. The unordered unique index on
--     (least(a,b), greatest(a,b)) prevents duplicate rows in both directions.
--   - requester_id / addressee_id preserved for future invite flows (email, QR).
--   - status = 'accepted' | 'pending' — 'pending' reserved for invite flow.
--   - expense_splits remains the single source of truth for who owes what.
--   - group_id IS NULL is the discriminator for "friend expense" vs "group expense".
--
-- See: docs/adr/0011-friends-and-flexible-expenses.md
-- =============================================================================


-- =============================================================================
-- 1. friendships table
-- =============================================================================

create table public.friendships (
  id           uuid        primary key default gen_random_uuid(),
  requester_id uuid        not null references public.profiles(id) on delete cascade,
  addressee_id uuid        not null references public.profiles(id) on delete cascade,
  status       text        not null default 'accepted'
               check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- Enforce unordered uniqueness: (A→B) and (B→A) treated as the same friendship.
-- Whichever direction was inserted first, the second attempt will conflict.
create unique index friendships_unordered_unique
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index idx_friendships_requester on public.friendships(requester_id);
create index idx_friendships_addressee on public.friendships(addressee_id);


-- =============================================================================
-- 2. Make expenses.group_id nullable
-- =============================================================================

alter table public.expenses
  alter column group_id drop not null;

-- The FK constraint stays; just removes the not-null restriction.
-- NULL group_id = friend expense (not associated with any group).


-- =============================================================================
-- 3. Make settlements.group_id nullable
-- =============================================================================

alter table public.settlements
  alter column group_id drop not null;


-- =============================================================================
-- 4. RLS: friendships
-- =============================================================================

alter table public.friendships enable row level security;

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


-- =============================================================================
-- 5. RLS: update expenses policies (drop old, create new)
-- =============================================================================

drop policy if exists "expenses: members can view"   on public.expenses;
drop policy if exists "expenses: members can create" on public.expenses;
drop policy if exists "expenses: creator can update" on public.expenses;
drop policy if exists "expenses: creator can delete" on public.expenses;

-- SELECT: group member (group expense) OR direct participant (friend expense)
create policy "expenses: members and participants can view"
  on public.expenses for select
  using (
    (group_id is not null and public.is_group_member(group_id))
    or
    (group_id is null and (
      paid_by = auth.uid()
      or exists (
        select 1 from public.expense_splits
        where expense_id = expenses.id
          and user_id    = auth.uid()
      )
    ))
  );

-- INSERT: group member if group expense; any authenticated user if friend expense.
-- Defence-in-depth — the actual write path is the create_expense() RPC (SECURITY DEFINER).
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


-- =============================================================================
-- 6. RLS: update expense_splits policies (drop old, create new)
-- =============================================================================

drop policy if exists "expense_splits: group members can view"       on public.expense_splits;
drop policy if exists "expense_splits: only expense creator can insert" on public.expense_splits;
drop policy if exists "expense_splits: only expense creator can delete" on public.expense_splits;

-- SELECT: follows parent expense visibility
create policy "expense_splits: participants can view"
  on public.expense_splits for select
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and (
          (e.group_id is not null and public.is_group_member(e.group_id))
          or
          (e.group_id is null and (
            e.paid_by = auth.uid()
            or user_id = auth.uid()
          ))
        )
    )
  );

create policy "expense_splits: only expense creator can insert"
  on public.expense_splits for insert
  with check (
    exists (
      select 1 from public.expenses e
      where e.id      = expense_id
        and e.created_by = auth.uid()
    )
  );

create policy "expense_splits: only expense creator can delete"
  on public.expense_splits for delete
  using (
    exists (
      select 1 from public.expenses e
      where e.id      = expense_id
        and e.created_by = auth.uid()
    )
  );


-- =============================================================================
-- 7. RLS: update settlements policies (drop old, create new)
-- =============================================================================

drop policy if exists "settlements: members can view"            on public.settlements;
drop policy if exists "settlements: members can create their own" on public.settlements;
drop policy if exists "settlements: creator can delete"           on public.settlements;

-- SELECT: group member (group settlement) OR direct party (friend settlement)
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


-- =============================================================================
-- 8. Updated RPC: create_expense (p_group_id now nullable)
-- =============================================================================

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

  -- 3. Insert expense (group_id can be NULL)
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
