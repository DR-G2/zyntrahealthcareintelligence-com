/** Single source for the V2 project's public URL and publishable key (both are public values). */
export const V2_DEFAULT_URL = 'https://hkowvjazuwebmibssdut.supabase.co';
export const V2_DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_7K6qFgHEEkaXOFz58cYE3g_l6XBW1tN';

export function resolveV2Config(env: Record<string, string | undefined> = import.meta.env as any) {
  return {
    url: (env.VITE_SUPABASE_V2_URL || V2_DEFAULT_URL).replace(/\/+$/, ''),
    publishableKey: env.VITE_SUPABASE_V2_PUBLISHABLE_KEY || V2_DEFAULT_PUBLISHABLE_KEY,
  };
}
