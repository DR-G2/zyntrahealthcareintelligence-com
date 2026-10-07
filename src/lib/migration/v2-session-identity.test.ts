import { beforeEach, describe, expect, it, vi } from "vitest";

const legacy = { session: null as null | { access_token: string; user: { email: string } } };
const v2State = { session: null as null | { user: { email: string; id: string } } };
const v2SignOut = vi.fn(async () => { v2State.session = null; return { error: null }; });
const verifyOtp = vi.fn(async () => {
  v2State.session = { user: { email: legacy.session!.user.email, id: "v2-" + legacy.session!.user.email } };
  return { error: null };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: legacy.session } }) } },
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
});
