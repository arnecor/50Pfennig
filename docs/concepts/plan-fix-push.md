# Push Notification Debugging Checklist

## Context

Push notifications are not working and the `send-push` Edge Function shows **0 invocations**. The full notification pipeline is:

```
Android app → FCM token → push_tokens table
Database Webhook (INSERT on expenses / group_members) → send-push edge function → FCM API → device
```

Zero invocations means **the webhooks are not configured yet** (one-time Dashboard setup) or the edge function is not deployed.

---

## Diagnostic Steps (in order)

### 1. Configure Database Webhooks ← most likely root cause for first-time setup

Webhooks are the official Supabase mechanism for calling Edge Functions on table events.
They are configured once in the Dashboard — no SQL or Postgres settings required.

**Find your service role key first:**
Dashboard → Project Settings → **API Keys** → "Legacy API Keys" tab → `service_role` → Reveal

**Create two webhooks** at Dashboard → Database → Webhooks → "Create a new webhook":

| Setting | Webhook 1 | Webhook 2 |
|---|---|---|
| Name | `notify-expense` | `notify-group-member` |
| Table | `expenses` | `group_members` |
| Events | INSERT | INSERT |
| Method | POST | POST |
| URL | `https://<project-ref>.supabase.co/functions/v1/send-push` | `https://<project-ref>.supabase.co/functions/v1/send-push` |

For both webhooks, add an HTTP header:
```
Authorization: Bearer <service_role_key>
```

After saving, create a new expense — the edge function should show its first invocation.

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

### 4. Verify pg_net is enabled

pg_net is used internally by Database Webhooks.

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_net';
```

Should return one row. If not, enable it at Dashboard → Database → Extensions.

---

### 5. Check push_tokens table has rows

```sql
SELECT count(*), platform FROM push_tokens GROUP BY platform;
```

If empty: the Android app is not registering tokens. Check that `initPushNotifications()` in `App.tsx` is being called and that permission was granted. Also ensure the app was built with the correct `google-services.json` (file exists at `android/app/google-services.json` with project `pfennig-50`).

---

### 6. Manually invoke the edge function

To test independently of webhooks:

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/send-push' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "INSERT",
    "table": "expenses",
    "schema": "public",
    "record": {
      "id": "<a-real-expense-uuid>",
      "paid_by": "<payer-user-uuid>",
      "description": "Test",
      "group_id": null
    },
    "old_record": null
  }'
```

If it returns `ok` (200) → check edge function logs in the Dashboard for FCM errors.

---

### 7. Inspect pg_net async HTTP results

After a webhook fires, check what pg_net sent and received:

```sql
SELECT id, status_code, error_msg, created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
```

A `status_code = 200` confirms the webhook reached the edge function successfully.

---

## Critical Files

| File | Role |
|---|---|
| `supabase/migrations/0006_push_tokens.sql` | push_tokens table + pg_net extension |
| `supabase/migrations/0007_remove_pg_net_triggers.sql` | Removes old manual triggers |
| `supabase/functions/send-push/index.ts` | Edge function — handles webhook envelope, queries DB, dispatches FCM |
| `src/lib/capacitor/pushNotifications.ts` | Client-side token registration |
| `android/app/google-services.json` | Firebase Android config (project: pfennig-50) ✅ exists |

---

## Setup Summary

1. **Configure Database Webhooks** in the Dashboard (Step 1 above)
2. **Set `FCM_SERVICE_ACCOUNT_JSON`** Supabase secret with the Firebase service account key
3. **Deploy the edge function** if not yet deployed

These three steps should get push notifications fully working end-to-end.
