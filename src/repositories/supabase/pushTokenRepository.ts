/**
 * repositories/supabase/pushTokenRepository.ts
 *
 * Stores and removes FCM push tokens in the push_tokens table.
 * Called only from lib/capacitor/pushNotifications.ts via App.tsx.
 * RLS ensures users can only manage their own tokens.
 */

import { supabase } from '../../lib/supabase/client';

export async function upsertPushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[Push] upsertPushToken called but no auth session — token not saved');
    return;
  }
  console.info('[Push] upserting token for user', user.id.slice(0, 8));

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: user.id, token, platform: 'android' },
      { onConflict: 'user_id,token' },
    );

  if (error) console.error('Failed to upsert push token', error);
}

export async function deletePushToken(token: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('token', token);

  if (error) console.error('Failed to delete push token', error);
}
