import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PieDiagnosticError, pieSyncFailure, requireV2SessionId } from "./pie-diagnostics";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("PIE hard-failure diagnostics (no silent legacy fallback)", () => {
  it("refuses to resume a V2 session without its V2 id", () => {
    expect(() => requireV2SessionId({})).toThrow(PieDiagnosticError);
    expect(() => requireV2SessionId({ v2SessionId: "" })).toThrow(/PIE_V2_SESSION_MISSING/);
    expect(requireV2SessionId({ v2SessionId: "s1" })).toBe("s1");
  });

  it("reports a failed PIE sync as a structured diagnostic", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = pieSyncFailure({ ok: false, diagnostic: { stage: "rebuild", message: "boom", code: "42501" } });
    expect(f?.code).toBe("PIE_STATE_SYNC_FAILED");
    expect(spy).toHaveBeenCalledWith("[PIE_DIAGNOSTIC]", expect.stringContaining("PIE_STATE_SYNC_FAILED"));
    expect(pieSyncFailure({ ok: true })).toBeNull();
    spy.mockRestore();
  });

  it("Practice never discards the PIE sync result and never downgrades a V2 resume", () => {
    const src = read("src/pages/Practice.tsx");
    expect(src).not.toMatch(/void syncPieEngine\(\);/);
    expect(src).toContain("requireV2SessionId(restoredSessionConfig)");
    expect(src).toContain("if (restoringV2) {");
    expect(read("src/pages/Assess.tsx")).toContain("syncPieEngine().then(pieSyncFailure)");
  });
});

describe("Shadow pipelines removed", () => {
  it("has no shadow edge functions or shadow client", () => {
    expect(existsSync(resolve(process.cwd(), "supabase/functions/pie-shadow-sync"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "supabase/functions/pie-shadow-run"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/lib/pie/shadow-client.ts"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/pages/PerformanceIntelligence.tsx"))).toBe(false);
  });
  it("seals the V2 shadow table", () => {
    expect(read("supabase/migrations_v2/0047_pie_deprecate_shadow.sql")).toContain("revoke all on pie.pie_shadow_run");
  });
});
