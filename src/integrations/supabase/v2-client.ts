import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';

/**
 * P3 cutover: there is ONE Supabase client (hkow, VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
 * The former separate V2 client is now an alias of the main client, so sessions/auth come from it directly.
 */
export function getSupabaseV2(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export const supabaseV2 = {
  rpc: (...args: Parameters<SupabaseClient['rpc']>) => getSupabaseV2().rpc(...args),
  from: (...args: Parameters<SupabaseClient['from']>) => getSupabaseV2().from(...args),
};
