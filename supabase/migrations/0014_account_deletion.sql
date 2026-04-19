-- Migration: 0014_account_deletion
--
-- Adds support for hard-deleting a user's account while preserving the
-- bookkeeping rows that other group/friend members still depend on
-- (expenses, splits, settlements, group memberships, friendships).
--
-- Concept (see plan: account-deletion):
--   1. profiles gains a `deleted_at` timestamp. When set, the profile is an
--      anonymised tombstone: display_name is cleared, avatar_url is NULL.
--   2. profiles.id loses its FK to auth.users so the profile row can outlive
--      the auth row. The handle_new_user() trigger continues to create
--      profiles for every new auth user.
--   3. Five FKs that previously pointed at auth.users are repointed at
--      public.profiles with ON DELETE RESTRICT — so the tombstone profile is
--      protected from accidental deletion as long as any history references
--      it. The IDs are identical UUIDs, so this is a constraint-only change
--      (no row rewrites).
--   4. anonymize_own_profile() RPC scrubs the caller's profile + dependent
--      personal data (push tokens, friend invites). Avatar storage and the
--      auth.users row itself are deleted by the `delete-account` Edge
--      Function with service-role privileges.
--   5. search_user_by_email() is extended to skip deleted profiles so they
--      cannot be re-discovered by email.

-- ---------------------------------------------------------------------------
-- 1. profiles.deleted_at
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Drop FK from profiles.id → auth.users(id)
--    The handle_new_user() trigger guarantees a profile row exists for every
--    new auth user. Dropping the constraint allows the profile row to remain
--    after the auth row is hard-deleted.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ---------------------------------------------------------------------------
-- 3. Repoint expense / settlement / group ownership FKs to profiles.
--    ON DELETE RESTRICT keeps the tombstone profile in place as long as any
--    historical row references it.
-- ---------------------------------------------------------------------------

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_paid_by_fkey,
  ADD  CONSTRAINT expenses_paid_by_fkey
       FOREIGN KEY (paid_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_created_by_fkey,
  ADD  CONSTRAINT expenses_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.expense_splits
  DROP CONSTRAINT IF EXISTS expense_splits_user_id_fkey,
  ADD  CONSTRAINT expense_splits_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.settlements
  DROP CONSTRAINT IF EXISTS settlements_from_user_id_fkey,
  ADD  CONSTRAINT settlements_from_user_id_fkey
       FOREIGN KEY (from_user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.settlements
  DROP CONSTRAINT IF EXISTS settlements_to_user_id_fkey,
  ADD  CONSTRAINT settlements_to_user_id_fkey
       FOREIGN KEY (to_user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_created_by_fkey,
  ADD  CONSTRAINT groups_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 4. anonymize_own_profile RPC
--
-- Caller-scoped: scrubs the *current user's* profile and deletes their
-- personal-only side data. Group memberships and friendships are kept so
-- historical balances remain visible to other members; the UI resolves the
-- tombstone profile to "Gelöschter Nutzer" via profiles.deleted_at.
--
-- This RPC is idempotent: calling it twice on an already-deleted account
-- has no observable effect.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.anonymize_own_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;

  UPDATE public.profiles
  SET display_name = '',
      avatar_url   = NULL,
      deleted_at   = COALESCE(deleted_at, now())
  WHERE id = v_user;

  DELETE FROM public.push_tokens     WHERE user_id    = v_user;
  DELETE FROM public.friend_invites  WHERE inviter_id = v_user OR used_by = v_user;
END;
$$;

REVOKE ALL    ON FUNCTION public.anonymize_own_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.anonymize_own_profile() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. search_user_by_email: skip tombstone profiles
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_user_by_email(p_email text)
RETURNS TABLE(user_id uuid, display_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT u.id AS user_id, p.display_name, u.email::text
  FROM   auth.users u
  JOIN   public.profiles p ON p.id = u.id
  WHERE  lower(u.email) = lower(p_email)
    AND  u.id <> auth.uid()
    AND  COALESCE(u.is_anonymous, false) = false
    AND  p.deleted_at IS NULL;
END;
$$;
