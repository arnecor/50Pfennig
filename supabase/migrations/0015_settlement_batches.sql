-- Migration 0015: Settlement batches (ADR-0012)
--
-- A single real-world payment can span multiple accounting contexts
-- (e.g. group debt + direct debt). This migration adds batch_id to link
-- settlement records from one payment, and an RPC to create them atomically.

-- 1. Add batch_id column
alter table public.settlements
  add column batch_id uuid;

create index idx_settlements_batch_id on public.settlements(batch_id);

-- 2. RPC: create_settlement_batch
--    Atomically inserts one settlement record per allocation.
--    All records share the same batch_id, note, and created_at.
create or replace function public.create_settlement_batch(
  p_from_user_id  uuid,
  p_to_user_id    uuid,
  p_note          text,
  p_allocations   jsonb   -- [{group_id: uuid|null, amount: int, from_user_id: uuid, to_user_id: uuid}]
)
returns uuid                -- the batch_id
language plpgsql
security definer as $$
declare
  v_batch_id   uuid := gen_random_uuid();
  v_alloc      jsonb;
  v_alloc_from uuid;
  v_alloc_to   uuid;
begin
  -- Auth check
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  -- Caller must be the from_user
  if auth.uid() <> p_from_user_id then
    raise exception 'You can only record settlements you sent'
      using errcode = 'P0001';
  end if;

  -- Must have at least one allocation
  if jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one allocation is required'
      using errcode = 'P0002';
  end if;

  -- Insert one settlement record per allocation
  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    -- Each allocation can have its own from/to (for cross-direction full settlement)
    v_alloc_from := (v_alloc->>'from_user_id')::uuid;
    v_alloc_to   := (v_alloc->>'to_user_id')::uuid;

    -- Validate: from and to must be different
    if v_alloc_from = v_alloc_to then
      raise exception 'from_user_id and to_user_id must differ'
        using errcode = 'P0002';
    end if;

    -- Validate: amount must be positive
    if (v_alloc->>'amount')::integer <= 0 then
      raise exception 'Settlement amount must be positive'
        using errcode = 'P0002';
    end if;

    -- Validate: group membership if group_id is set
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

-- 3. RPC: delete_settlement_batch
--    Deletes all settlement records in a batch atomically.
--    Only the original from_user (the person who paid) can delete.
create or replace function public.delete_settlement_batch(
  p_batch_id uuid
)
returns void
language plpgsql
security definer as $$
begin
  -- Auth check
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  -- Verify the caller is the from_user on at least one record in the batch
  -- (the primary direction sender)
  if not exists (
    select 1 from public.settlements
    where batch_id = p_batch_id
      and from_user_id = auth.uid()
  ) then
    raise exception 'You can only delete settlements you initiated'
      using errcode = 'P0001';
  end if;

  -- Delete all records in the batch
  delete from public.settlements
  where batch_id = p_batch_id;
end;
$$;
