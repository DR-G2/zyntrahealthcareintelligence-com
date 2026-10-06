import { createClient } from '@supabase/supabase-js';

/**
 * V2 Supabase client.
 * This is intentionally separate from the legacy production client.
 * Do not import this into production routes until cutover is approved.
 */
const V2_URL = import.meta.env.VITE_SUPABASE_V2_URL;
const V2_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_V2_PUBLISHABLE_KEY;

if (!V2_URL || !V2_PUBLISHABLE_KEY) {
  throw new Error(
    'V2 Supabase is not configured. Set VITE_SUPABASE_V2_URL and VITE_SUPABASE_V2_PUBLISHABLE_KEY before using the V2 client.'
  );
}

export const supabaseV2 = createClient(V2_URL, V2_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
