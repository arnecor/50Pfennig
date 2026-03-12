# Push Notification Debugging Checklist

## Context

Push notifications are not working and the `send-push` Edge Function shows **0 invocations**. The full notification pipeline is:

```
Android app → FCM token → push_tokens table
Postgres INSERT trigger → pg_net HTTP POST → send-push edge function → FCM API → device
```

Zero invocations means **the triggers are never reaching the edge function**. The most likely root cause is that two required Postgres database settings (`app.supabase_url` and `app.supabase_service_role_key`) were never set on the production database. Both trigger functions silently `RETURN NEW` when these are empty strings (see migration `0006_push_tokens.sql` lines 104–107 and 186–189).

Even if that is fixed, a second blocker is the `FCM_SERVICE_ACCOUNT_JSON` secret — the edge function silently returns `200 ok` without sending anything when this is missing (lines 205–209 of `send-push/index.ts`).

---

## Diagnostic Steps (in order)

### 1. Check Postgres database settings ← most likely root cause

In the **Supabase Dashboard → SQL Editor** (production project):

```sql
SELECT current_setting('app.supabase_url', true) AS supabase_url,
       current_setting('app.supabase_service_role_key', true) AS service_key;
```

**Expected:** non-empty values matching your project URL and service role key.
**If empty** — this IS the root cause. Fix with:

```sql
ALTER DATABASE postgres
  SET app.supabase_url = 'https://<project-ref>.supabase.co';

ALTER DATABASE postgres
  SET app.supabase_service_role_key = '<service-role-key>';
```

Get the service role key from **Supabase Dashboard → Settings → API → service_role (secret)**.
After running ALTER DATABASE, create a new expense — the edge function should show its first invocation.

---

### 2. Check FCM_SERVICE_ACCOUNT_JSON secret

```bash
supabase secrets list --project-ref <project-ref>
```

**Expected:** `FCM_SERVICE_ACCOUNT_JSON` appears in the list.
**If missing:**
1. Go to [Firebase Console](https://console.firebase.google.com) → Project `pfennig-50` → Project Settings → Service Accounts
2. Click **Generate new private key** → download the JSON file
3. Set it as a secret:
   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" --project-ref <project-ref>
   ```

---

### 3. Verify the edge function is deployed

```bash
supabase functions list --project-ref <project-ref>
```

`send-push` must appear. If not:
```bash
supabase functions deploy send-push --project-ref <project-ref>
```

---

### 4. Verify pg_net is enabled and triggers are active

```sql
-- Check pg_net extension
SELECT extname FROM pg_extension WHERE extname = 'pg_net';

-- Check triggers
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname IN ('notify_on_expense_created', 'notify_on_group_member_added');
```

Both triggers should show `tgenabled = 'O'` (enabled).

---

### 5. Check push_tokens table has rows

```sql
SELECT count(*), platform FROM push_tokens GROUP BY platform;
```

If empty: the Android app is not registering tokens. Check that `initPushNotifications()` in `App.tsx` is being called and that permission was granted. Also ensure the app was built with the correct `google-services.json` (file exists at `android/app/google-services.json` with project `pfennig-50`).

---

### 6. Manually invoke the edge function

To test independently of triggers:

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/send-push' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientId": "<a-real-user-uuid>",
    "title": "Test",
    "body": "Test notification",
    "data": { "type": "expense" }
  }'
```

If it returns `ok` (200) → check edge function logs in dashboard for errors (FCM auth failures, token not found, etc.).

---

### 7. Inspect pg_net async HTTP results

After creating a test expense (with step 1 fixed), check what pg_net sent and received:

```sql
SELECT id, status_code, error_msg, created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
```

A `status_code = 200` confirms the trigger reached the edge function successfully.

---

## Critical Files

| File | Role |
|---|---|
| `supabase/migrations/0006_push_tokens.sql` | Trigger functions + Postgres settings requirement |
| `supabase/functions/send-push/index.ts` | Edge function — FCM dispatch logic |
| `src/lib/capacitor/pushNotifications.ts` | Client-side token registration |
| `android/app/google-services.json` | Firebase Android config (project: pfennig-50) ✅ exists |

---

## Most Likely Fix Summary

1. **Run ALTER DATABASE** to set `app.supabase_url` and `app.supabase_service_role_key` in production
2. **Set `FCM_SERVICE_ACCOUNT_JSON`** Supabase secret with the Firebase service account key
3. Redeploy the edge function if not yet deployed

These two steps should get push notifications fully working end-to-end.
