/**
 * Edge Function: delete-account
 *
 * Permanently deletes the calling user's account.
 *
 * Steps (all best-effort and idempotent — safe to retry on partial failure):
 *   1. Verify the JWT from the Authorization header.
 *   2. As the user (anon-key client + bearer): call rpc('anonymize_own_profile')
 *      which scrubs PII on profiles and deletes push tokens / friend invites.
 *   3. As service-role: remove the avatar object at avatars/{userId}/avatar.
 *   4. As service-role: hard-delete the auth.users row.
 *
 * Group memberships, friendships, expenses, expense_splits and settlements
 * are intentionally preserved so other members' history and balances stay
 * intact — they resolve through the tombstone profile (deleted_at IS NOT NULL)
 * which the UI renders as "Gelöschter Nutzer".
 *
 * Required environment variables (auto-injected by Supabase):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[delete-account] Missing Supabase env vars');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'Missing bearer token' }, 401);
  }

  // 1. Verify JWT and resolve user id via the user-scoped client.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    console.warn('[delete-account] Unauthorized', userError?.message);
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  const userId = userData.user.id;

  // 2. Anonymise profile + delete personal-only side data (within user's RLS scope).
  const { error: rpcError } = await userClient.rpc('anonymize_own_profile');
  if (rpcError) {
    console.error('[delete-account] anonymize_own_profile failed', rpcError);
    return jsonResponse(
      { error: 'Failed to anonymise profile', details: rpcError.message },
      500,
    );
  }

  // From here on use the admin client for storage + auth deletion.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Delete avatar (best-effort — ignore "not found").
  const { error: storageError } = await adminClient.storage
    .from('avatars')
    .remove([`${userId}/avatar`]);
  if (storageError) {
    console.warn(
      '[delete-account] Avatar removal warning (continuing):',
      storageError.message,
    );
  }

  // 4. Hard-delete the auth user. Profile row remains as a tombstone because
  //    the FK from profiles.id → auth.users(id) was dropped in migration 0014.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('[delete-account] auth.admin.deleteUser failed', deleteError);
    return jsonResponse(
      { error: 'Failed to delete auth user', details: deleteError.message },
      500,
    );
  }

  console.log(`[delete-account] Successfully deleted user ${userId}`);
  return jsonResponse({ success: true }, 200);
});
