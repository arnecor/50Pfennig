/**
 * Edge Function: send-push
 *
 * Sends Firebase Cloud Messaging (FCM) push notifications triggered by
 * Supabase Database Webhooks.  Three webhooks call this function:
 *
 *   1. expenses     → INSERT  — notifies every non-payer split participant
 *   2. group_members → INSERT  — notifies the newly added member
 *   3. settlements  → INSERT  — notifies the recipient of a payment
 *
 * The webhook body is the standard Supabase envelope:
 *   {
 *     type:       'INSERT';
 *     table:      'expenses' | 'group_members' | 'settlements';
 *     schema:     'public';
 *     record:     Record<string, unknown>;   // the inserted row
 *     old_record: null;
 *   }
 *
 * Required environment variables:
 *   SUPABASE_URL              — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 *   FCM_SERVICE_ACCOUNT_JSON  — Firebase service account JSON
 *                               (set via `supabase secrets set`)
 *
 * Dashboard setup (one-time):
 *   Database → Webhooks → Create webhook
 *   Table: expenses,      Event: INSERT, URL: .../functions/v1/send-push
 *   Table: group_members, Event: INSERT, URL: .../functions/v1/send-push
 *   Header: Authorization: Bearer <service_role_key>
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

interface FcmServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

interface PushJob {
  recipientId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Google OAuth2 — exchange service account credentials for a short-lived token
// ---------------------------------------------------------------------------

async function signJWT(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const encodedSig = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${encodedSig}`;
}

async function getFcmAccessToken(sa: FcmServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const jwt = await signJWT(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth2 token exchange failed: ${err}`);
  }

  const json = await res.json();
  return json.access_token as string;
}

// ---------------------------------------------------------------------------
// FCM HTTP v1
// ---------------------------------------------------------------------------

async function sendFcmMessage(
  projectId: string,
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ success: boolean; tokenInvalid: boolean }> {
  const tokenPrefix = deviceToken.slice(0, 20);
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  console.log(`[FCM] Sending to token ${tokenPrefix}…`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title, body },
        data: { ...data, title, body },
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'default',
          },
        },
      },
    }),
  });

  const responseText = await res.text();
  console.log(`[FCM] HTTP ${res.status} for token ${tokenPrefix}: ${responseText}`);

  if (res.ok) return { success: true, tokenInvalid: false };

  let err: { error?: { status?: string } } = {};
  try { err = JSON.parse(responseText); } catch { /* ignore */ }
  const status = err?.error?.status ?? '';
  const tokenInvalid =
    status === 'INVALID_ARGUMENT' || status === 'UNREGISTERED';

  console.error('[FCM] Send failed', { httpStatus: res.status, fcmStatus: status, tokenPrefix });
  return { success: false, tokenInvalid };
}

// ---------------------------------------------------------------------------
// Send push notifications to a list of recipients
// ---------------------------------------------------------------------------

async function dispatchPushJobs(
  supabase: ReturnType<typeof createClient>,
  sa: FcmServiceAccount,
  jobs: PushJob[],
): Promise<void> {
  if (jobs.length === 0) return;

  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken(sa);
    console.log('[FCM] OAuth2 access token obtained successfully');
  } catch (err) {
    console.error('[FCM] Failed to get access token', err);
    return;
  }

  await Promise.all(
    jobs.map(async ({ recipientId, title, body, data }) => {
      const { data: tokens, error } = await supabase
        .from('push_tokens')
        .select('id, token')
        .eq('user_id', recipientId);

      if (error) {
        console.error('Failed to fetch push tokens for', recipientId, error);
        return;
      }
      console.log(`[send-push] Found ${tokens?.length ?? 0} token(s) for recipient ${recipientId}`);
      if (!tokens || tokens.length === 0) return;

      const staleTokenIds: string[] = [];

      await Promise.all(
        tokens.map(async ({ id, token }: { id: string; token: string }) => {
          const result = await sendFcmMessage(
            sa.project_id,
            accessToken,
            token,
            title,
            body,
            data,
          );
          if (result.tokenInvalid) staleTokenIds.push(id);
        }),
      );

      if (staleTokenIds.length > 0) {
        await supabase.from('push_tokens').delete().in('id', staleTokenIds);
        console.log(`Pruned ${staleTokenIds.length} stale push token(s)`);
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Webhook handlers
// ---------------------------------------------------------------------------

/**
 * expenses INSERT — notify every non-payer participant.
 */
async function handleExpenseInsert(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
): Promise<PushJob[]> {
  const expenseId = record.id as string;
  const paidBy = record.paid_by as string;
  const description = (record.description as string) || '';
  const groupId = record.group_id as string | null;

  // Payer display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', paidBy)
    .maybeSingle();

  const payerName = (profile?.display_name as string | null) ?? 'Jemand';

  // Non-payer split participants
  const { data: splits, error } = await supabase
    .from('expense_splits')
    .select('user_id')
    .eq('expense_id', expenseId)
    .neq('user_id', paidBy);

  if (error) {
    console.error('Failed to fetch expense_splits', error);
    return [];
  }

  return (splits ?? []).map(({ user_id }: { user_id: string }) => ({
    recipientId: user_id,
    title: `${payerName} hat eine Ausgabe hinzugefügt`,
    body: description,
    data:
      groupId != null
        ? { type: 'expense', expenseId, groupId }
        : { type: 'expense', expenseId, friendId: paidBy },
  }));
}

/**
 * group_members INSERT — notify the new member (skip creator self-join).
 */
async function handleGroupMemberInsert(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
): Promise<PushJob[]> {
  const userId = record.user_id as string;
  const groupId = record.group_id as string;

  const { data: group } = await supabase
    .from('groups')
    .select('name, created_by')
    .eq('id', groupId)
    .maybeSingle();

  // Skip creator auto-join (mirrors the original trigger's auth.uid() check)
  if (group?.created_by === userId) return [];

  return [
    {
      recipientId: userId,
      title: 'Du wurdest zu einer Gruppe hinzugefügt',
      body: (group?.name as string | null) ?? '',
      data: { type: 'group_member', groupId },
    },
  ];
}

/**
 * settlements INSERT — notify the recipient of a payment.
 *
 * Batch deduplication: when a batch settlement is recorded, multiple rows
 * sharing the same batch_id are committed in a single transaction, so this
 * function fires once per row. We only send one notification — for the row
 * whose id is lexicographically smallest in the batch — and sum all amounts
 * so the recipient sees the full payment total.
 */
async function handleSettlementInsert(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
): Promise<PushJob[]> {
  const settlementId = record.id as string;
  const fromUserId = record.from_user_id as string;
  const toUserId = record.to_user_id as string;
  const groupId = record.group_id as string | null;
  const batchId = record.batch_id as string | null;
  let amount = record.amount as number;

  if (batchId) {
    // Only proceed for the first row in the batch (smallest id → deterministic)
    const { data: first } = await supabase
      .from('settlements')
      .select('id')
      .eq('batch_id', batchId)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (first?.id !== settlementId) return []; // another row will handle this batch

    // Sum all allocations to show the real-world total
    const { data: batchRows } = await supabase
      .from('settlements')
      .select('amount')
      .eq('batch_id', batchId);
    amount = (batchRows ?? []).reduce(
      (sum: number, r: { amount: unknown }) => sum + (r.amount as number),
      0,
    );
  }

  // Payer display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', fromUserId)
    .maybeSingle();
  const payerName = (profile?.display_name as string | null) ?? 'Jemand';

  // German-locale amount formatting (cents → "12,50 €")
  const formatted = `${(amount / 100).toFixed(2).replace('.', ',')} €`;

  const data: Record<string, string> = {
    type: 'settlement',
    settlementId,
    ...(batchId && { batchId }),
    ...(groupId != null ? { groupId } : { friendId: fromUserId }),
  };

  return [
    {
      recipientId: toUserId,
      title: `${payerName} hat eine Zahlung geleistet`,
      body: formatted,
      data,
    },
  ];
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const saJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!saJson) {
    console.warn('FCM_SERVICE_ACCOUNT_JSON not set — skipping push');
    return new Response('ok', { status: 200 });
  }

  let sa: FcmServiceAccount;
  try {
    sa = JSON.parse(saJson) as FcmServiceAccount;
  } catch {
    console.error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON');
    return new Response('Server configuration error', { status: 500 });
  }

  let webhook: WebhookPayload;
  try {
    webhook = (await req.json()) as WebhookPayload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  console.log(`[send-push] Webhook received: table=${webhook.table} type=${webhook.type}`);

  if (webhook.type !== 'INSERT') {
    // Webhooks for UPDATE/DELETE are not expected; ignore gracefully.
    return new Response('ok', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let jobs: PushJob[] = [];

  if (webhook.table === 'expenses') {
    jobs = await handleExpenseInsert(supabase, webhook.record);
  } else if (webhook.table === 'group_members') {
    jobs = await handleGroupMemberInsert(supabase, webhook.record);
  } else if (webhook.table === 'settlements') {
    jobs = await handleSettlementInsert(supabase, webhook.record);
  } else {
    console.warn('Unexpected webhook table:', webhook.table);
  }

  console.log(`[send-push] Dispatching ${jobs.length} push job(s)`);
  await dispatchPushJobs(supabase, sa, jobs);

  return new Response('ok', { status: 200 });
});
