import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import * as pieClient from "./pie-practice-client";
import { pieSessionErrorMessage } from "./pie-practice-client";

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return p.includes("integrations") ? [] : walk(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("P5: every attempt/selection path is PIE", () => {
  it("paid lock: the pie_diagnostic entry is removed; no source starts a non-adaptive PIE session", () => {
    expect((pieClient as Record<string, unknown>).startPieDiagnostic).toBeUndefined();
    const hits = walk(resolve(root, "src")).filter((f) => /p_mode:\s*['"](?!pie_adaptive)/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("server refusals are mapped to readable messages", () => {
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
