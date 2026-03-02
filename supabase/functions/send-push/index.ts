/**
 * Edge Function: send-push
 *
 * Sends a Firebase Cloud Messaging (FCM) push notification to all registered
 * devices of a given user.
 *
 * Called by Postgres triggers (via pg_net) after:
 *   - a new expense is created (notifies non-payer participants)
 *   - a user is added to a group (notifies the new member)
 *
 * Request body:
 *   {
 *     recipientId: string;   // auth.users UUID of the target user
 *     title:       string;   // notification title
 *     body:        string;   // notification body text
 *     data:        {         // navigation payload for the client
 *       type:      'expense' | 'group_member';
 *       expenseId?: string;
 *       groupId?:  string;
 *       friendId?: string;   // payer's user_id for friend expenses
 *     };
 *   }
 *
 * Required environment variables (set via `supabase secrets set`):
 *   SUPABASE_URL                — project URL (auto-injected by Supabase)
 *   SUPABASE_SERVICE_ROLE_KEY   — service role key (auto-injected)
 *   FCM_SERVICE_ACCOUNT_JSON    — Firebase service account JSON (full JSON string)
 *
 * FCM setup:
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Add an Android app with package name "com.pfennig50.app"
 *   3. Download google-services.json and place it in android/app/
 *   4. Go to Project Settings → Service Accounts → Generate new private key
 *   5. Set the downloaded JSON as FCM_SERVICE_ACCOUNT_JSON:
 *      supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PushPayload {
  recipientId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

interface FcmServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

// ---------------------------------------------------------------------------
// Google OAuth2 — exchange service account credentials for a short-lived token
// ---------------------------------------------------------------------------

/**
 * Signs a JWT using the RS256 algorithm with the service account private key.
 * Deno's WebCrypto API is used directly — no external JWT libraries needed.
 */
async function signJWT(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(
      /\//g,
      '_',
    );

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Strip PEM armor and decode
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
  ).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${signingInput}.${encodedSig}`;
}

/**
 * Obtains a short-lived Google OAuth2 access token for the FCM send scope.
 */
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
// FCM HTTP v1 — send to a single device token
// ---------------------------------------------------------------------------

async function sendFcmMessage(
  projectId: string,
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ success: boolean; tokenInvalid: boolean }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          // data payload is delivered even when the app is in the background
          data: { ...data, title, body },
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: 'default',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
        },
      }),
    },
  );

  if (res.ok) return { success: true, tokenInvalid: false };

  const err = await res.json().catch(() => ({}));
  const status = (err as { error?: { status?: string } })?.error?.status ?? '';
  // INVALID_ARGUMENT or UNREGISTERED → token is stale, should be deleted
  const tokenInvalid = status === 'INVALID_ARGUMENT' ||
    status === 'UNREGISTERED';

  console.error('FCM send failed', { status, deviceToken: deviceToken.slice(0, 20) });
  return { success: false, tokenInvalid };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // -------------------------------------------------------------------------
  // Parse and validate FCM service account from env
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Parse request body
  // -------------------------------------------------------------------------
  let payload: PushPayload;
  try {
    payload = (await req.json()) as PushPayload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { recipientId, title, body, data } = payload;
  if (!recipientId || !title || !body) {
    return new Response('Missing required fields', { status: 400 });
  }

  // Ensure all data values are strings (FCM data payload requirement)
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    stringData[k] = String(v);
  }

  // -------------------------------------------------------------------------
  // Fetch push tokens for the recipient (service role bypasses RLS)
  // -------------------------------------------------------------------------
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: tokens, error: tokensError } = await supabase
    .from('push_tokens')
    .select('id, token')
    .eq('user_id', recipientId);

  if (tokensError) {
    console.error('Failed to fetch push tokens', tokensError);
    return new Response('Database error', { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    // Recipient has no registered devices — that's fine, nothing to do
    return new Response('ok', { status: 200 });
  }

  // -------------------------------------------------------------------------
  // Get FCM access token (one per invocation; valid for 1 hour)
  // -------------------------------------------------------------------------
  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken(sa);
  } catch (err) {
    console.error('Failed to get FCM access token', err);
    return new Response('FCM auth failed', { status: 500 });
  }

  // -------------------------------------------------------------------------
  // Send to each device token; prune stale tokens
  // -------------------------------------------------------------------------
  const staleTokenIds: string[] = [];

  await Promise.all(
    tokens.map(async ({ id, token }: { id: string; token: string }) => {
      const result = await sendFcmMessage(
        sa.project_id,
        accessToken,
        token,
        title,
        body,
        stringData,
      );
      if (result.tokenInvalid) staleTokenIds.push(id);
    }),
  );

  if (staleTokenIds.length > 0) {
    await supabase.from('push_tokens').delete().in('id', staleTokenIds);
    console.log(`Pruned ${staleTokenIds.length} stale push token(s)`);
  }

  return new Response('ok', { status: 200 });
});
