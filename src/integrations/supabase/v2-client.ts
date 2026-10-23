import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveV2Config } from './v2-config';

/**
 * Certified V2 project default is assembled in v2-config.ts.
 * Runtime URL and publishable key are resolved centrally by v2-config.ts.
 * V2 Supabase client.
 * Intentionally separate from the legacy production client.
 *
 * The client is created lazily so importing migration code never breaks the
 * existing app when V2 environment variables are not configured.
 */
let client: SupabaseClient | null = null;

export function getSupabaseV2(): SupabaseClient {
  if (client) return client;

  const { url, publishableKey } = resolveV2Config();

  // P20-certified production target. Keep this guard aligned with the live deployment gate.
  const CERTIFIED_V2_PROJECT_URL = 'https://hkowvjazuwebmibssdut.supabase.co';
  if (import.meta.env.PROD && url !== CERTIFIED_V2_PROJECT_URL) {
    throw new Error('V2 Supabase URL does not match the certified production project.');
  }

  if (!url || !publishableKey) {
    throw new Error(
      'V2 Supabase is not configured. Set VITE_SUPABASE_V2_URL and VITE_SUPABASE_V2_PUBLISHABLE_KEY before using the V2 client.'
    );
  }

  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return client;
}

/**
 * Legacy production routes should continue using the existing client until
 * V2 cutover is explicitly approved.
 */
export const supabaseV2 = {
  rpc: (...args: Parameters<SupabaseClient['rpc']>) => getSupabaseV2().rpc(...args),
  from: (...args: Parameters<SupabaseClient['from']>) => getSupabaseV2().from(...args),
};
