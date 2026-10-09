import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { startPieDiagnostic, pieSessionErrorMessage, type PieDeps } from "./pie-practice-client";

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return p.includes("integrations") ? [] : walk(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

function deps(rpcImpl: PieDeps["rpc"]): PieDeps {
  return {
    ensureSession: vi.fn(async () => undefined), rpc: vi.fn(rpcImpl),
    saveAttempt: vi.fn(async () => ({}) as never), complete: vi.fn(async () => ({})),
    results: vi.fn(async () => []), resume: vi.fn(async () => ({})),
  };
}

describe("P5: every attempt/selection path is PIE", () => {
  it("diagnostic is created by the server in pie_diagnostic mode, clamped to 10..50, no ids sent", async () => {
    const d = deps(async (fn) => fn === "pie_create_session"
      ? { data: [{ session_id: "d1", question_count: 10 }], error: null }
      : { data: [{ question_id: "q0", question_position: 0, stem: "s", options: [], correct_answer: "A", explanation: "x" }], error: null });
    const r = await startPieDiagnostic(3, d);
    expect(d.rpc).toHaveBeenCalledWith("pie_create_session", { p_count: 10, p_blueprint_key: "ZYNTRA_GENERAL", p_mode: "pie_diagnostic" });
    expect(JSON.stringify((d.rpc as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("p_question_ids");
    expect(r.questions[0]).not.toHaveProperty("correct_answer");
    expect(r.questions[0]).not.toHaveProperty("explanation");
    await startPieDiagnostic(500, d);
    expect(d.rpc).toHaveBeenCalledWith("pie_create_session", expect.objectContaining({ p_count: 50 }));
  });

  it("server refusals are surfaced, not swallowed", async () => {
    const d = deps(async () => ({ data: null, error: { message: "PIE_DIAGNOSTIC_RATE_LIMITED: one diagnostic per 24 hours" } }));
    await expect(startPieDiagnostic(20, d)).rejects.toThrow(/PIE_DIAGNOSTIC_RATE_LIMITED/);
    expect(pieSessionErrorMessage("PIE_DIAGNOSTIC_ACTIVE: x")).toMatch(/in progress/);
    expect(pieSessionErrorMessage("PIE_DIAGNOSTIC_RATE_LIMITED: x")).toMatch(/24 hours/);
  });

  it("Assess uses the PIE diagnostic only: no client pool, sequencing, grading or key", () => {
    const src = read("src/pages/Assess.tsx");
    expect(src).toContain("startPieDiagnostic");
    expect(src).toContain("submitPieAnswer");
    expect(src).toContain("finishPieSession");
    expect(src).not.toMatch(/from\(['"]questions['"]\)/);
    expect(src).not.toMatch(/correct_answer/);
    expect(src).not.toMatch(/selectNextQuestion|persistAttemptsViaV2|@\/lib\/supabase/);
  });

  it("no source file uses a legacy selection/attempt RPC or client-chosen session", () => {
    const banned = /rpc\(\s*['"](create_practice_session|get_practice_question_pool|get_diagnostic_question|submit_diagnostic_answer)['"]|persistAttemptsViaV2|createV2PracticeSession|from\(['"]user_attempts['"]\)\s*\.(insert|upsert|update)/;
    const hits = walk(resolve(root, "src")).filter((f) => banned.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("removed legacy paths stay removed", () => {
    const files = walk(resolve(root, "src")).map((f) => f.replace(root + "/", ""));
    for (const f of ["src/lib/migration/v2-attempt-writer.ts", "src/lib/sequencing.ts", "src/pages/SharedTests.tsx"]) expect(files).not.toContain(f);
    const gut = read("src/pages/TrustYourGut.tsx");
    expect(gut).not.toMatch(/from\(['"]questions['"]\)/);
    expect(gut).not.toMatch(/=== *currentQ(uestion)?\.correct_answer/);
  });

  it("0059: diagnostic mode, PIE-only save_attempt, client-chosen sets revoked", () => {
    const m = read("supabase/migrations_v2/0059_pie_p5_diagnostic_mode_pie_only_attempts.sql");
    expect(m).toContain("p_mode text default 'pie_adaptive'");
    expect(m).toContain("PIE_SESSION_REQUIRED");
    expect(m).toContain("revoke execute on function public.create_practice_session(text, jsonb, uuid[]) from public, anon, authenticated");
    expect(m).toContain("revoke execute on function public.get_practice_question_pool(integer) from public, anon, authenticated");
    expect(m).toContain("'diagnostic_quota'");
  });
});
