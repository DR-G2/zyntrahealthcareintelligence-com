import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { persistAttemptsViaV2, type PersistDeps } from "./v2-attempt-writer";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

function deps(overrides: Partial<PersistDeps> = {}) {
  const calls: string[] = [];
  const d: PersistDeps = {
    ensureSession: vi.fn(async () => { calls.push("ensure"); }),
    createSession: vi.fn(async () => { calls.push("create"); return { id: "s1" } as never; }),
    saveAttempt: vi.fn(async () => { calls.push("save"); return {} as never; }),
    completeSession: vi.fn(async () => { calls.push("complete"); return {} as never; }),
    ...overrides,
  };
  return { d, calls };
}

describe("B1: single server-graded attempt write path", () => {
  it("creates a session, saves answered attempts, then completes", async () => {
    const { d, calls } = deps();
    const r = await persistAttemptsViaV2("diagnostic", {}, [
      { questionId: "q1", selectedAnswer: "A" },
      { questionId: "q2", selectedAnswer: "" },
    ], d);
    expect(r).toEqual({ sessionId: "s1", saved: 1 });
    expect(calls).toEqual(["ensure", "create", "save", "complete"]);
    expect(d.createSession).toHaveBeenCalledWith("diagnostic", {}, ["q1"]);
  });

  it("throws on failure and never completes the session (no fallback)", async () => {
    const { d } = deps({ saveAttempt: vi.fn(async () => { throw new Error("rpc down"); }) });
    await expect(persistAttemptsViaV2("mcq", {}, [{ questionId: "q1", selectedAnswer: "A" }], d)).rejects.toThrow("rpc down");
    expect(d.completeSession).not.toHaveBeenCalled();
  });

  it("no page writes or deletes user_attempts directly", () => {
    for (const f of ["src/pages/Practice.tsx", "src/pages/Assess.tsx", "src/pages/Settings.tsx"]) {
      expect(read(f)).not.toMatch(/from\(['"]user_attempts['"]\)\s*\.\s*(insert|delete|update|upsert)/);
    }
    expect(read("src/pages/Settings.tsx")).toContain("eraseMyLearningDataV2()");
    expect(read("src/lib/migration/v2-practice-session.ts")).toContain("rpc('erase_my_learning_data'");
  });

  it("0048 contains the erase RPC, owner-scoped trigger bypass and mid-drill evidence filter", () => {
    const sql = read("supabase/migrations_v2/0048_pie_p2_review_fixes.sql");
    expect(sql).toContain("create or replace function public.erase_my_learning_data(p_confirm text)");
    expect(sql).toContain("current_user not in ('anon', 'authenticated')");
    expect(sql).toContain("= old.user_id::text");
    expect(sql).toContain("insert into pie.learning_data_erasure_audit");
    expect(sql.match(/ps\.status = 'completed'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("PIE_RATE_LIMITED");
    expect(sql).toContain("limit c_max_attempts");
    expect(sql).toContain("revoke update, delete, truncate, references, trigger on intelligence.behavior_events from anon, authenticated");
    expect(sql).toContain("'client_reported_validated'");
  });
});
