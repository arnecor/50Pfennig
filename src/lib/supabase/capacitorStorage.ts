/**
 * lib/supabase/capacitorStorage.ts
 *
 * A Supabase-compatible storage adapter backed by @capacitor/preferences.
 * This persists auth tokens to native Android SharedPreferences instead of
 * WebView localStorage, which can be cleared by the OS under memory pressure.
 *
 * Implements the SupportedStorage interface from @supabase/supabase-js.
 */

import { Preferences } from '@capacitor/preferences';

export const capacitorStorage = {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },

  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  },
};
