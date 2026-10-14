import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const legacy = { session: null as null | { access_token: string; user: { email: string } } };
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: legacy.session } }) } },
}));

const { ensureV2Session } = await import("./v2-practice-session");

describe("P3: single hkow client, no auth bridge", () => {
  it("resolves when the main client has a session (no bridge fetch)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    legacy.session = { access_token: "t", user: { email: "a@x.test" } };
    await ensureV2Session();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails when the main session is gone", async () => {
    legacy.session = null;
    await expect(ensureV2Session()).rejects.toThrow(/expired/);
  });

  it("source never calls v2-auth-bridge and v2 client aliases the main client", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/migration/v2-practice-session.ts"), "utf8");
    expect(src).not.toMatch(/functions\/v1\/v2-auth-bridge/);
    expect(src).not.toContain("verifyOtp");
    const v2 = readFileSync(resolve(process.cwd(), "src/integrations/supabase/v2-client.ts"), "utf8");
    expect(v2).toContain("from './client'");
    expect(v2).not.toMatch(/createClient\(/);
    expect(v2).not.toMatch(/sb_publishable_/);
  });
});
