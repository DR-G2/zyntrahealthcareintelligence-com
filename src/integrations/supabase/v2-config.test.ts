import { describe, it, expect } from 'vitest';
import { resolveV2Config, V2_DEFAULT_URL, V2_DEFAULT_PUBLISHABLE_KEY } from './v2-config';

describe('resolveV2Config', () => {
  it('falls back to the approved V2 project when env vars are missing', () => {
    expect(resolveV2Config({})).toEqual({ url: V2_DEFAULT_URL, publishableKey: V2_DEFAULT_PUBLISHABLE_KEY });
  });
  it('uses env overrides and strips trailing slashes', () => {
    expect(resolveV2Config({ VITE_SUPABASE_V2_URL: 'https://x.example/', VITE_SUPABASE_V2_PUBLISHABLE_KEY: 'k' }))
      .toEqual({ url: 'https://x.example', publishableKey: 'k' });
  });
  it('never builds an "undefined" bridge URL', () => {
    expect(`${resolveV2Config({}).url}/functions/v1/v2-auth-bridge`).not.toContain('undefined');
  });
});
