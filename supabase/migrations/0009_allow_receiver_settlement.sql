-- Migration: Allow receivers to record incoming settlements
--
-- Previously, only the sender (from_user_id) could record a settlement.
-- This migration relaxes that restriction so either participant can record it.
-- Affects: create_settlement_batch RPC + settlements INSERT RLS policy.

-- 1. Recreate create_settlement_batch with relaxed participant check
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

  if auth.uid() <> p_from_user_id and auth.uid() <> p_to_user_id then
    raise exception 'You must be a participant of this settlement'
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

-- 2. Relax INSERT RLS policy — allow sender OR receiver to insert
drop policy if exists "settlements: participants can create" on public.settlements;

create policy "settlements: participants can create"
  on public.settlements for insert
  with check (
    (auth.uid() = from_user_id or auth.uid() = to_user_id)
    and (
      group_id is null
      or public.is_group_member(group_id)
    )
  );
