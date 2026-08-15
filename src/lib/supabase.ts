import { createClient } from '@supabase/supabase-js';

// Supabase is wired up but OPTIONAL for local dev. The app runs fully on
// localStorage until you add the two env vars below (see .env.example),
// at which point you can migrate the zustand store to read/write Supabase.
//
// Migration plan (later):
//   1. Run supabase/schema.sql in your Supabase SQL editor.
//   2. Fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env.
//   3. Replace the localStorage calls in src/store/useData.ts with the
//      matching supabase.from('<table>') queries — field names already match.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;
