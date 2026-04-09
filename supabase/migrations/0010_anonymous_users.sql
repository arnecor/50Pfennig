-- 0010_anonymous_users.sql
--
-- Enables Supabase anonymous sign-ins (guest mode) to coexist safely with the
-- existing auth/profile/RLS architecture.
--
-- This migration is deliberately minimal:
--   * NO new columns. We rely on auth.users.is_anonymous (native column) and
--     the (auth.jwt() ->> 'is_anonymous') JWT claim, avoiding the sync problem
--     that would come from duplicating the flag into profiles.
--   * The existing handle_new_user() trigger (0004) already handles the guest
--     case naturally: new.email is NULL → split_part(NULL, '@', 1) returns NULL
--     → the final '' fallback in the COALESCE chain kicks in. Display name for
--     guests is supplied by the client via options.data.display_name on
--     signInAnonymously(), which the trigger reads on INSERT.
--
-- The two real changes are:
--   (a) search_user_by_email() must not return anonymous users so guests never
--       appear in the friend-by-email lookup.
--   (b) friend_invites INSERT is blocked for anonymous users because the
--       feature depends on an email identity the guest does not have.
--
-- NOTE: Anonymous sign-ins must also be enabled in the Supabase Dashboard:
--   Authentication → Providers → Email → Enable Anonymous Sign-ins.
-- That is a project-level setting and cannot be toggled from a migration.

-- (a) search_user_by_email: exclude anonymous users from search results.
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
    and u.id <> auth.uid()
    and coalesce(u.is_anonymous, false) = false;
end;
$$;

-- (b) friend_invites INSERT: block anonymous users via JWT claim.
-- The claim is set by Supabase on every access token for is_anonymous=true users.
-- coalesce(..., false) keeps legacy tokens (pre-anonymous feature) working.
drop policy if exists "friend_invites: users can create own" on public.friend_invites;
create policy "friend_invites: users can create own"
  on public.friend_invites for insert
  with check (
    inviter_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
