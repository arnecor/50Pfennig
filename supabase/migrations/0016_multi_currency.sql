-- =============================================================================
-- 0016_multi_currency.sql
--
-- Adds per-expense and per-settlement currency support with FX conversion to a
-- configurable group base currency. Existing data is backfilled as EUR with
-- fxRate=1 (no recalculation needed).
--
-- New columns:
--   profiles.default_currency   — user's preferred currency (default EUR)
--   groups.base_currency        — currency for balances and settlements
--   groups.default_currency     — default currency for new expenses
--   expenses.currency           — original expense currency
--   expenses.fx_rate            — units of expense currency per 1 base currency
--   expenses.base_total_amount  — totalAmount converted to base currency
--   settlements.currency        — original settlement currency
--   settlements.fx_rate         — units of settlement currency per 1 base currency
--   settlements.base_amount     — amount converted to base currency
--
-- RPC changes:
--   create_group        — accepts p_base_currency, p_default_currency
--   create_expense      — accepts p_currency, p_fx_rate, p_base_total_amount
--   update_expense      — accepts p_currency, p_fx_rate, p_base_total_amount
--   create_settlement_batch — allocations gain currency, fx_rate, base_amount
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Schema changes — new columns with defaults for backwards compatibility
-- ---------------------------------------------------------------------------

-- profiles: user default currency
alter table public.profiles
  add column if not exists default_currency text not null default 'EUR'
    check (char_length(default_currency) = 3);

-- groups: base currency (settlements) and default currency (new expenses)
alter table public.groups
  add column if not exists base_currency text not null default 'EUR'
    check (char_length(base_currency) = 3);

alter table public.groups
  add column if not exists default_currency text not null default 'EUR'
    check (char_length(default_currency) = 3);

-- expenses: original currency, FX rate, and base-currency equivalent
alter table public.expenses
  add column if not exists currency text not null default 'EUR'
    check (char_length(currency) = 3);

alter table public.expenses
  add column if not exists fx_rate numeric not null default 1.0
    check (fx_rate > 0);

alter table public.expenses
  add column if not exists base_total_amount integer not null default 0
    check (base_total_amount >= 0);

-- settlements: original currency, FX rate, and base-currency equivalent
alter table public.settlements
  add column if not exists currency text not null default 'EUR'
    check (char_length(currency) = 3);

alter table public.settlements
  add column if not exists fx_rate numeric not null default 1.0
    check (fx_rate > 0);

alter table public.settlements
  add column if not exists base_amount integer not null default 0
    check (base_amount >= 0);


-- ---------------------------------------------------------------------------
-- 2. Backfill existing data — all EUR, rate 1, base = original
-- ---------------------------------------------------------------------------

update public.expenses
  set base_total_amount = total_amount
  where base_total_amount = 0;

update public.settlements
  set base_amount = amount
  where base_amount = 0;


-- ---------------------------------------------------------------------------
-- 3. RPC: create_group — add currency parameters
-- ---------------------------------------------------------------------------

create or replace function public.create_group(
  p_name             text,
  p_member_ids       uuid[]  default '{}',
  p_base_currency    text    default 'EUR',
  p_default_currency text    default 'EUR'
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

  insert into public.groups (name, created_by, base_currency, default_currency)
  values (p_name, v_uid, p_base_currency, p_default_currency)
  returning * into v_group;

  insert into public.group_members (group_id, user_id)
  values (v_group.id, v_uid);

  if p_member_ids is not null then
    foreach v_member in array p_member_ids loop
      insert into public.group_members (group_id, user_id)
      values (v_group.id, v_member);
    end loop;
  end if;

  return v_group;
end;
$$;


-- ---------------------------------------------------------------------------
-- 4. RPC: create_expense — add currency parameters
--
-- Splits are now validated against p_base_total_amount (not p_total_amount)
-- because splits are computed in group base currency.
-- ---------------------------------------------------------------------------

create or replace function public.create_expense(
  p_group_id           uuid,
  p_description        text,
  p_total_amount       integer,
  p_paid_by            uuid,
  p_split_type         text,
  p_split_config       jsonb,
  p_splits             jsonb,
  p_currency           text    default 'EUR',
  p_fx_rate            numeric default 1.0,
  p_base_total_amount  integer default null
)
returns public.expenses
language plpgsql
security definer as $$
declare
  v_expense           public.expenses;
  v_split             jsonb;
  v_sum               integer;
  v_base_total_amount integer;
begin
  v_base_total_amount := coalesce(p_base_total_amount, p_total_amount);

  -- 1. Authorization
  if p_group_id is not null and not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group'
      using errcode = 'P0001';
  end if;

  if p_group_id is null and auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  -- 2. Validate: splits must sum exactly to base_total_amount
  select coalesce(sum((s->>'amount')::integer), 0)
  into   v_sum
  from   jsonb_array_elements(p_splits) s;

  if v_sum <> v_base_total_amount then
    raise exception 'Splits sum (%) does not equal base_total_amount (%)',
      v_sum, v_base_total_amount
      using errcode = 'P0002';
  end if;

  -- 3. Insert expense
  insert into public.expenses (
    group_id, description, total_amount,
    paid_by, split_type, split_config, created_by,
    currency, fx_rate, base_total_amount
  ) values (
    p_group_id, p_description, p_total_amount,
    p_paid_by, p_split_type, p_split_config, auth.uid(),
    p_currency, p_fx_rate, v_base_total_amount
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


-- ---------------------------------------------------------------------------
-- 5. RPC: update_expense — add currency parameters
-- ---------------------------------------------------------------------------

create or replace function public.update_expense(
  p_expense_id         uuid,
  p_description        text,
  p_total_amount       integer,
  p_paid_by            uuid,
  p_split_type         text,
  p_split_config       jsonb,
  p_splits             jsonb,
  p_currency           text    default 'EUR',
  p_fx_rate            numeric default 1.0,
  p_base_total_amount  integer default null
)
returns public.expenses
language plpgsql
security definer as $$
declare
  v_expense           public.expenses;
  v_split             jsonb;
  v_sum               integer;
  v_base_total_amount integer;
begin
  v_base_total_amount := coalesce(p_base_total_amount, p_total_amount);

  -- 1. Authorization: only the original creator can update
  if not exists (
    select 1 from public.expenses
    where id = p_expense_id and created_by = auth.uid()
  ) then
    raise exception 'Expense not found or not authorized'
      using errcode = 'P0001';
  end if;

  -- 2. Validate: splits must sum exactly to base_total_amount
  select coalesce(sum((s->>'amount')::integer), 0)
  into   v_sum
  from   jsonb_array_elements(p_splits) s;

  if v_sum <> v_base_total_amount then
    raise exception 'Splits sum (%) does not equal base_total_amount (%)',
      v_sum, v_base_total_amount
      using errcode = 'P0002';
  end if;

  -- 3. Update expense
  update public.expenses set
    description       = p_description,
    total_amount      = p_total_amount,
    paid_by           = p_paid_by,
    split_type        = p_split_type,
    split_config      = p_split_config,
    currency          = p_currency,
    fx_rate           = p_fx_rate,
    base_total_amount = v_base_total_amount
  where id = p_expense_id
  returning * into v_expense;

  -- 4. Replace splits
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


-- ---------------------------------------------------------------------------
-- 6. RPC: create_settlement_batch — add currency fields to allocations
--
-- Allocation format now includes optional currency fields:
--   [{"group_id": uuid|null, "amount": int, "from_user_id": uuid,
--     "to_user_id": uuid, "currency": text, "fx_rate": numeric,
--     "base_amount": int}, ...]
-- ---------------------------------------------------------------------------

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
      batch_id, group_id, from_user_id, to_user_id, amount, note,
      currency, fx_rate, base_amount
    ) values (
      v_batch_id,
      case when v_alloc->>'group_id' is not null
           then (v_alloc->>'group_id')::uuid
           else null end,
      v_alloc_from,
      v_alloc_to,
      (v_alloc->>'amount')::integer,
      p_note,
      coalesce(v_alloc->>'currency', 'EUR'),
      coalesce((v_alloc->>'fx_rate')::numeric, 1.0),
      coalesce((v_alloc->>'base_amount')::integer, (v_alloc->>'amount')::integer)
    );
  end loop;

  return v_batch_id;
end;
$$;
