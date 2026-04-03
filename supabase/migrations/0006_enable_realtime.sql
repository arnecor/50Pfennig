-- Migration: Enable Supabase Realtime for tables that need push sync
--
-- Adds tables to the supabase_realtime publication so that connected clients
-- receive postgres_changes events. RLS policies already in place ensure users
-- only receive events for rows they are authorised to read.
--
-- Tables covered:
--   expenses       — expense creates/updates/deletes (own + group context)
--   expense_splits — split changes (derived balance updates)
--   settlements    — settlement creates/deletes
--   friendships    — friend invite accept/decline/removal
--   group_members  — member joins/leaves
--   group_events   — group lifecycle events (activity feed)

ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_splits;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE group_events;
