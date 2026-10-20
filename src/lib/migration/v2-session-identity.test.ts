import { beforeEach, describe, expect, it, vi } from "vitest";

const legacy = { session: null as null | { access_token: string; user: { email: string; id?: string } } };
const getLegacySession = vi.fn(async () => ({ data: { session: legacy.session } }));
const refreshSession = vi.fn(async () => {
  if (legacy.session) legacy.session = { ...legacy.session, access_token: 'refreshed' };
  return { error: null };
});
const v2State = { session: null as null | { user: { email: string; id: string } } };
const v2SignOut = vi.fn(async () => { v2State.session = null; return { error: null }; });
const verifyOtp = vi.fn(async () => {
  if (!legacy.session) throw new Error('Missing legacy session');
  v2State.session = { user: { email: legacy.session.user.email, id: "v2-" + legacy.session.user.email } };
  return { error: null };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: getLegacySession, refreshSession } },
}));
vi.mock("@/integrations/supabase/v2-client", () => ({
  getSupabaseV2: () => ({
    auth: {
      getSession: async () => ({ data: { session: v2State.session } }),
      signOut: v2SignOut,
      verifyOtp,
    },
  }),
}));

const { ensureV2Session } = await import("./v2-practice-session");

describe("ensureV2Session identity binding", () => {
  beforeEach(() => {
    v2SignOut.mockClear();
    verifyOtp.mockClear();
    getLegacySession.mockClear();
    refreshSession.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ token_hash: "hash" }) })));
  });

  it("reuses the V2 session when it belongs to the signed-in Zyntra user", async () => {
    legacy.session = { access_token: "t", user: { email: "a@x.test" } };
    v2State.session = { user: { email: "A@x.test", id: "v2-a" } };
    await ensureV2Session();
    expect(v2SignOut).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("discards a stale V2 session from a different account and re-bridges", async () => {
    legacy.session = { access_token: "t", user: { email: "b@x.test" } };
    v2State.session = { user: { email: "a@x.test", id: "v2-a" } };
    await ensureV2Session();
    expect(v2SignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(verifyOtp).toHaveBeenCalled();
    expect(v2State.session?.user.email).toBe("b@x.test");
  });

  it("clears the V2 session and fails when the Zyntra session is gone", async () => {
    legacy.session = null;
    v2State.session = { user: { email: "a@x.test", id: "v2-a" } };
    await expect(ensureV2Session()).rejects.toThrow(/expired/);
    expect(v2SignOut).toHaveBeenCalled();
    expect(v2State.session).toBeNull();
  });

  it('does not send a bridge request after logout during session lookup', async () => {
    legacy.session = { access_token: 'old', user: { email: 'a@x.test', id: 'a' } };
    v2State.session = null;
    getLegacySession.mockImplementationOnce(async () => {
      const session = legacy.session;
      legacy.session = null;
      return { data: { session } };
    });
    await expect(ensureV2Session()).rejects.toThrow(/expired/);
    expect(fetch).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('retries a rejected token once with a refreshed token', async () => {
    legacy.session = { access_token: 'old', user: { email: 'a@x.test', id: 'a' } };
    v2State.session = null;
    const bridge = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token_hash: 'hash' }) });
    vi.stubGlobal('fetch', bridge);
    await ensureV2Session();
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(bridge).toHaveBeenCalledTimes(2);
    expect(bridge.mock.calls[1][1].headers.Authorization).toBe('Bearer refreshed');
  });

  it('does not accept a bridge response after an account switch', async () => {
    legacy.session = { access_token: 'old', user: { email: 'a@x.test', id: 'a' } };
    v2State.session = null;
    vi.stubGlobal('fetch', vi.fn(async () => {
      legacy.session = { access_token: 'other', user: { email: 'b@x.test', id: 'b' } };
      return { ok: true, status: 200, json: async () => ({ token_hash: 'hash' }) };
    }));
    await expect(ensureV2Session()).rejects.toThrow(/expired/);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('fails closed after a second 401 without further retries', async () => {
    legacy.session = { access_token: 'old', user: { email: 'a@x.test', id: 'a' } };
    v2State.session = null;
    const bridge = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'Legacy session could not be verified.' }) }));
    vi.stubGlobal('fetch', bridge);
    await expect(ensureV2Session()).rejects.toThrow(/could not be verified/);
    expect(bridge).toHaveBeenCalledTimes(2);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
