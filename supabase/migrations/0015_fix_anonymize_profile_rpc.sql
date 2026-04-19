-- Migration: 0015_fix_anonymize_profile_rpc
--
-- Fixes a bug in anonymize_own_profile() introduced in 0014: that function
-- referenced friend_invites.used_by which was dropped in migration 0008
-- (multi-use invites redesign). Replace the DELETE with one that only filters
-- on inviter_id, which is the only remaining user reference on that table.

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

  DELETE FROM public.push_tokens    WHERE user_id    = v_user;
  DELETE FROM public.friend_invites WHERE inviter_id = v_user;
END;
$$;

REVOKE ALL    ON FUNCTION public.anonymize_own_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.anonymize_own_profile() TO authenticated;
