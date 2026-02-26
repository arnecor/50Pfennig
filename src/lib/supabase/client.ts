/**
 * lib/supabase/client.ts
 *
 * The Supabase client singleton.
 *
 * This is the ONLY place in the codebase where the Supabase client is
 * instantiated. All other code that needs Supabase imports from here.
 *
 * Environment variables (set in .env.local):
 *   VITE_SUPABASE_URL      - Your Supabase project URL
 *   VITE_SUPABASE_ANON_KEY - Your Supabase anonymous (public) key
 *
 * The anon key is safe to expose in the client — Supabase RLS policies
 * enforce data access rules at the database level.
 *
 * Imported by: repositories/supabase/*
 * Do NOT import this in: domain/, features/ (use repositories instead)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types.gen';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Copy .env.local.example to .env.local and fill in your values.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
