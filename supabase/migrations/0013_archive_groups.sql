-- Migration: 0013_archive_groups
--
-- Adds archive support to groups:
--   1. is_archived / archived_at columns on public.groups
--   2. archive_group RPC (any member, not anonymous-gated at DB level)
--   3. unarchive_group RPC
--   4. get_groups_for_user RPC — replaces direct table query in getAll():
--      - Tier 1: groups with expenses, ordered by most recent expense DESC
--      - Tier 2: groups with no expenses, ordered by created_at DESC

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_archived boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_groups_is_archived ON public.groups (is_archived);

-- ---------------------------------------------------------------------------
-- 2. archive_group RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only a current member may archive.
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this group' USING errcode = 'P0001';
  END IF;

  UPDATE public.groups
  SET is_archived = true,
      archived_at = now()
  WHERE id          = p_group_id
    AND is_archived = false;   -- idempotent: no-op if already archived
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. unarchive_group RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.unarchive_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only a current member may reactivate.
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this group' USING errcode = 'P0001';
  END IF;

  UPDATE public.groups
  SET is_archived = false,
      archived_at = NULL
  WHERE id          = p_group_id
    AND is_archived = true;    -- idempotent: no-op if already active
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. get_groups_for_user RPC
--
-- Returns SETOF public.groups so PostgREST can embed group_members via FK.
-- Sort order:
--   Tier 1 (top): groups with ≥1 expense → most recent expense first
--   Tier 2 (bottom): groups with no expenses → most recently created first
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_groups_for_user()
RETURNS SETOF public.groups
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT g.*
  FROM   public.groups g
  JOIN   public.group_members gm
           ON gm.group_id = g.id
          AND gm.user_id  = auth.uid()
  LEFT JOIN public.expenses e
           ON e.group_id = g.id
  GROUP BY g.id
  ORDER BY
    (MAX(e.created_at) IS NULL) ASC,               -- groups with expenses first
    COALESCE(MAX(e.created_at), g.created_at) DESC; -- most recent activity first
$$;
