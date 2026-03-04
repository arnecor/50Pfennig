-- =============================================================================
-- Migration: 0006_push_tokens
-- Description: Push notification infrastructure
--
-- Tables:    push_tokens  — FCM registration token per user per device
-- Extension: pg_net       — async HTTP from triggers
-- Functions: notify_expense_participants()   — fires after expense INSERT
--            notify_new_group_member()       — fires after group_members INSERT
-- Triggers:  notify_on_expense_created
--            notify_on_group_member_added
--
-- Required Supabase configuration (run once after deploying this migration):
--
--   ALTER DATABASE postgres
--     SET app.supabase_url = 'https://<project-ref>.supabase.co';
--   ALTER DATABASE postgres
--     SET app.supabase_service_role_key = '<service-role-key>';
--
-- The service role key is used by the trigger to call the send-push Edge
-- Function on behalf of any user. It is stored as a session-level Postgres
-- setting rather than in a table to keep it out of the data plane.
-- For local dev both settings default to empty strings; notifications are
-- silently skipped when either is unset.
-- =============================================================================


-- =============================================================================
-- EXTENSION
-- =============================================================================

-- pg_net enables non-blocking HTTP calls from Postgres triggers.
-- Available on all Supabase projects (free tier included).
create extension if not exists pg_net;


-- =============================================================================
-- TABLE: push_tokens
-- =============================================================================

create table public.push_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  token      text        not null,
  platform   text        not null default 'android'
             check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create index idx_push_tokens_user_id on public.push_tokens(user_id);


-- =============================================================================
-- RLS: push_tokens
-- =============================================================================

alter table public.push_tokens enable row level security;

-- Each user may only read and write their own tokens.
create policy "push_tokens: users manage own"
  on public.push_tokens
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());


-- =============================================================================
-- HELPER: read Postgres settings safely
-- =============================================================================

-- Returns '' when the setting is not configured (avoids raising exceptions
-- for local dev environments where the settings may not be set).
create or replace function public.get_app_setting(p_key text)
returns text
language sql
stable
security definer as $$
  select coalesce(current_setting(p_key, true), '');
$$;


-- =============================================================================
-- TRIGGER FUNCTION: notify_expense_participants
--
-- Fires after every INSERT on public.expenses.
-- Sends a push notification to every expense split participant who is NOT the
-- payer, including both group expenses (group_id IS NOT NULL) and friend
-- expenses (group_id IS NULL).
-- =============================================================================

create or replace function public.notify_expense_participants()
returns trigger
language plpgsql
security definer as $$
declare
  v_supabase_url text;
  v_service_key  text;
  v_payer_name   text;
  v_recipient    uuid;
  v_payload      jsonb;
begin
  v_supabase_url := public.get_app_setting('app.supabase_url');
  v_service_key  := public.get_app_setting('app.supabase_service_role_key');

  -- Skip silently when the project is not configured (local dev, CI, …)
  if v_supabase_url = '' or v_service_key = '' then
    return new;
  end if;

  -- Resolve payer display name from profiles
  select coalesce(display_name, 'Jemand')
  into   v_payer_name
  from   public.profiles
  where  id = new.paid_by;

  -- Notify each participant who is not the payer
  for v_recipient in
    select es.user_id
    from   public.expense_splits es
    where  es.expense_id = new.id
      and  es.user_id   <> new.paid_by
  loop
    -- Build navigation data based on expense type
    v_payload := jsonb_build_object(
      'recipientId', v_recipient::text,
      'title',       v_payer_name || ' hat eine Ausgabe hinzugefügt',
      'body',        new.description,
      'data',        case
                       when new.group_id is not null then
                         jsonb_build_object(
                           'type',      'expense',
                           'expenseId', new.id::text,
                           'groupId',   new.group_id::text
                         )
                       else
                         jsonb_build_object(
                           'type',      'expense',
                           'expenseId', new.id::text,
                           'friendId',  new.paid_by::text
                         )
                     end
    );

    perform net.http_post(
      url     := v_supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := v_payload::text
    );
  end loop;

  return new;
end;
$$;

create trigger notify_on_expense_created
  after insert on public.expenses
  for each row execute function public.notify_expense_participants();


-- =============================================================================
-- TRIGGER FUNCTION: notify_new_group_member
--
-- Fires after every INSERT on public.group_members.
-- Notifies the newly added user that they have been added to a group.
-- Self-joins (i.e., the user who triggered the insert equals the new member,
-- which happens when the group creator is added on group creation) are skipped.
-- =============================================================================

create or replace function public.notify_new_group_member()
returns trigger
language plpgsql
security definer as $$
declare
  v_supabase_url text;
  v_service_key  text;
  v_group_name   text;
begin
  -- Skip if the user added themselves (group creator auto-join)
  if new.user_id = auth.uid() then
    return new;
  end if;

  v_supabase_url := public.get_app_setting('app.supabase_url');
  v_service_key  := public.get_app_setting('app.supabase_service_role_key');

  if v_supabase_url = '' or v_service_key = '' then
    return new;
  end if;

  select name into v_group_name from public.groups where id = new.group_id;

  perform net.http_post(
    url     := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'recipientId', new.user_id::text,
      'title',       'Du wurdest zu einer Gruppe hinzugefügt',
      'body',        coalesce(v_group_name, ''),
      'data',        jsonb_build_object(
        'type',    'group_member',
        'groupId', new.group_id::text
      )
    )::text
  );

  return new;
end;
$$;

create trigger notify_on_group_member_added
  after insert on public.group_members
  for each row execute function public.notify_new_group_member();
