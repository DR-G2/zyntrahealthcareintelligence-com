import { describe, expect, it, vi } from 'vitest';
import { resolveCaller, type VerifyClaims } from '../../../supabase/functions/pie-telemetry-audit/caller';

const USER = '11111111-1111-1111-1111-111111111111';
const ok: VerifyClaims = async () => ({ data: { claims: { sub: USER, role: 'authenticated' } }, error: null });

describe('pie-telemetry-audit caller resolution', () => {
  it('accepts repeated audit calls with the same session token (P21.1-12/14/15)', async () => {
    const verify = vi.fn(ok);
    const header = 'Bearer session-token';
    const results = [await resolveCaller(header, verify), await resolveCaller(header, verify), await resolveCaller(header, verify)];
    expect(results.every((r) => r.ok && r.userId === USER)).toBe(true);
    expect(verify).toHaveBeenCalledTimes(3);
    expect(verify).toHaveBeenNthCalledWith(3, 'session-token');
  });

  it('accepts a refreshed token after an earlier one in the same session', async () => {
    const verify = vi.fn(ok);
    expect((await resolveCaller('Bearer old', verify)).ok).toBe(true);
    expect((await resolveCaller('Bearer refreshed', verify)).ok).toBe(true);
    expect(verify).toHaveBeenLastCalledWith('refreshed');
  });

  it('still rejects missing, invalid and non-authenticated tokens', async () => {
    expect(await resolveCaller(null, ok)).toMatchObject({ ok: false, status: 401, error: 'missing_authorization' });
    const bad: VerifyClaims = async () => ({ data: null, error: { message: 'invalid JWT' } });
    expect(await resolveCaller('Bearer x', bad)).toMatchObject({ ok: false, status: 401, error: 'unauthorized' });
    const anon: VerifyClaims = async () => ({ data: { claims: { sub: USER, role: 'anon' } }, error: null });
    expect(await resolveCaller('Bearer x', anon)).toMatchObject({ ok: false, status: 401 });
  });
});
