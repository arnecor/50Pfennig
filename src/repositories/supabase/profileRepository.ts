/**
 * repositories/supabase/profileRepository.ts
 *
 * Profile-related data access. Currently only exposes deleteOwnAccount();
 * existing display-name and avatar operations still live inline in
 * features/auth/hooks/useAuth.ts — see docs/TECH_DEBT.md for the planned
 * consolidation.
 *
 * deleteOwnAccount() invokes the `delete-account` Edge Function which:
 *   1. Anonymises the caller's profile (RPC anonymize_own_profile)
 *   2. Removes the avatar storage object
 *   3. Hard-deletes the auth.users row
 *
 * The local sign-out cleanup (push token removal, IndexedDB clear, navigation)
 * happens in the caller (useAuth.deleteAccount) by reusing the existing
 * SIGNED_OUT handling chain.
 */

import { supabase } from '../../lib/supabase/client';

export class SupabaseProfileRepository {
  async deleteOwnAccount(): Promise<void> {
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean;
      error?: string;
      details?: string;
    }>('delete-account', {
      method: 'POST',
    });

    if (error) {
      throw new Error(error.message || 'Account deletion failed');
    }
    if (!data?.success) {
      const detail = data?.details ? `: ${data.details}` : '';
      throw new Error(`${data?.error ?? 'Account deletion failed'}${detail}`);
    }
  }
}
