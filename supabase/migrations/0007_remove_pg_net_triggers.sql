-- =============================================================================
-- Migration: 0007_remove_pg_net_triggers
-- Description: Remove manual pg_net triggers in favour of Supabase Database
--              Webhooks, which are the official way to call Edge Functions on
--              table events.  Webhooks are configured in the Dashboard
--              (Database → Webhooks) and handle pg_net plumbing internally —
--              no Postgres-level credential settings are required.
--
-- See docs/concepts/plan-fix-push.md for the one-time Dashboard setup steps.
-- =============================================================================

DROP TRIGGER IF EXISTS notify_on_expense_created    ON public.expenses;
DROP TRIGGER IF EXISTS notify_on_group_member_added ON public.group_members;

DROP FUNCTION IF EXISTS public.notify_expense_participants();
DROP FUNCTION IF EXISTS public.notify_new_group_member();
DROP FUNCTION IF EXISTS public.get_app_setting(text);
