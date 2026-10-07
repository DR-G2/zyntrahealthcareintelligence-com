import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { normaliseEmail, isExactAdminRow, clampPage, canReadQuestionBank } from "../../../supabase/functions/admin-question-bank/policy";
import { adminCorsHeaders, parseAllowedOrigins, hasAdminRole, DEFAULT_ADMIN_ORIGINS } from "../../../supabase/functions/_shared/admin-gate";
import {
  attemptDeletionConfirmed, CONFIRM_DELETE_USER_ATTEMPTS, deleteQuestionsGuarded, partitionForDelete,
} from "../../../supabase/functions/_shared/question-delete-guard";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Hank B1/B2: server-checked admin paths", () => {
  it("exact case-insensitive admin match, no wildcard semantics", () => {
    expect(normaliseEmail("  Admin@Zyntra.COM ")).toBe("admin@zyntra.com");
    expect(isExactAdminRow({ email: "Admin@zyntra.com" }, "admin@zyntra.com")).toBe(true);
    expect(isExactAdminRow({ email: "a%@zyntra.com" }, "abc@zyntra.com")).toBe(false);
    expect(isExactAdminRow({ email: "a_c@zyntra.com" }, "abc@zyntra.com")).toBe(false);
    expect(isExactAdminRow(null, "abc@zyntra.com")).toBe(false);
    expect(isExactAdminRow({ email: "abc@zyntra.com" }, null)).toBe(false);
    // lower-case on BOTH sides
    expect(isExactAdminRow({ email: " ABC@Zyntra.com " }, "Abc@ZYNTRA.com")).toBe(true);
  });

  it("admin-question-bank is super_admin only", () => {
    expect(canReadQuestionBank({ email: "boss@zyntra.com", role: "super_admin" }, "boss@zyntra.com")).toBe(true);
    expect(canReadQuestionBank({ email: "Boss@Zyntra.com", role: "super_admin" }, "boss@zyntra.com")).toBe(true);
    expect(canReadQuestionBank({ email: "ops@zyntra.com", role: "admin" }, "ops@zyntra.com")).toBe(false);
    expect(canReadQuestionBank({ email: "other@zyntra.com", role: "super_admin" }, "boss@zyntra.com")).toBe(false);
    expect(canReadQuestionBank(null, "boss@zyntra.com")).toBe(false);
    expect(hasAdminRole({ email: "ops@zyntra.com", role: "admin" }, "ops@zyntra.com", ["super_admin", "admin"])).toBe(true);
    expect(hasAdminRole({ email: "ops@zyntra.com", role: "owner" }, "ops@zyntra.com", ["super_admin", "admin"])).toBe(false);
  });

  it("pages are clamped", () => {
    expect(clampPage(-5, 99999)).toEqual({ from: 0, to: 999 });
    expect(clampPage(2000, 10)).toEqual({ from: 2000, to: 2009 });
  });

  it("admin-question-bank checks admin_roles server-side with .eq before reading questions", () => {
    const src = read("supabase/functions/admin-question-bank/index.ts");
    expect(src).toContain('.from("admin_roles").select("role, email").eq("email", email)');
    expect(src.indexOf("canReadQuestionBank(role, email)")).toBeLessThan(src.indexOf('.from("questions")'));
    expect(src).not.toContain(".ilike(");
    expect(src).not.toContain('"Access-Control-Allow-Origin": "*"');
  });

  it("/questions (and /questions/mcq) read the bank only through the admin function", () => {
    const q = read("src/pages/Questions.tsx");
    expect(q).toContain("invoke('admin-question-bank'");
    expect(q).not.toMatch(/fetchAllRows\('questions'/);
    expect(q).not.toMatch(/from\(['"]questions['"]\)/);
    expect(q).not.toMatch(/fetchAllRows\('user_attempts'/);
    expect(read("src/pages/QuestionsMCQ.tsx")).toMatch(/import Questions from '\.\/Questions'/);
  });

  it("no src file selects answer keys through a client", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "integrations" ? [] : walk(`${d}/${e.name}`)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [`${d}/${e.name}`] : []);
    const hits = walk(resolve(process.cwd(), "src")).filter((f) => /\.select\([^)]*\b(correct_answer|explanation)\b/.test(readFileSync(f, "utf8")) || /from\(['"]questions['"]\)\s*\.select\(['"]\*/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
    expect(read("src/pages/Practice.tsx")).not.toMatch(/from\(['"]user_attempts['"]\)/);
  });

  it("every admin function restricts CORS to app origins (no wildcard)", () => {
    const dir = resolve(process.cwd(), "supabase/functions");
    for (const f of readdirSync(dir).filter((n) => n.startsWith("admin-"))) {
      expect(read(`supabase/functions/${f}/index.ts`), f).not.toMatch(/"Access-Control-Allow-Origin":\s*"\*"/);
    }
    for (const f of ["admin-manage-questions", "admin-cleanup-questions", "admin-question-bank"]) {
      expect(read(`supabase/functions/${f}/index.ts`), f).toContain("adminCorsHeaders(req.headers.get(\"Origin\"), allowedOrigins)");
    }
  });

  it("CORS helper only reflects allowed app origins and never accepts *", () => {
    const allowed = parseAllowedOrigins(undefined);
    expect(allowed).toEqual([...DEFAULT_ADMIN_ORIGINS]);
    expect(adminCorsHeaders("https://zyntrahealthcareintelligence.com", allowed)["Access-Control-Allow-Origin"]).toBe("https://zyntrahealthcareintelligence.com");
    expect(adminCorsHeaders("https://evil.example", allowed)["Access-Control-Allow-Origin"]).toBe(DEFAULT_ADMIN_ORIGINS[0]);
    expect(adminCorsHeaders(null, allowed)["Access-Control-Allow-Origin"]).toBe(DEFAULT_ADMIN_ORIGINS[0]);
    expect(adminCorsHeaders("x", allowed).Vary).toBe("Origin");
    expect(parseAllowedOrigins("*")).toEqual([...DEFAULT_ADMIN_ORIGINS]);
    expect(parseAllowedOrigins("https://a.example/, *, https://b.example")).toEqual(["https://a.example", "https://b.example"]);
  });

  it("question deletes never touch user_attempts directly and use the guard", () => {
    for (const f of ["admin-manage-questions", "admin-cleanup-questions"]) {
      const src = read(`supabase/functions/${f}/index.ts`);
      expect(src, f).not.toMatch(/from\("user_attempts"\)\.delete\(\)/);
      expect(src, f).toContain("deleteQuestionsGuarded(supabase");
      expect(src, f).toContain("attemptDeletionConfirmed(body)");
      expect(src, f).not.toContain(".ilike(");
      expect(src, f).toContain('select("role, email").eq("email", callerEmail');
    }
    expect(read("supabase/functions/admin-cleanup-questions/index.ts")).toContain('hasAdminRole(adminRole, callerEmail, ["super_admin"])');
    expect(read("supabase/functions/admin-manage-questions/index.ts")).toMatch(/\}, 409\);/);
  });
  it("legacy key revoke is prepared outside the auto-applied migrations folder", () => {
    const m = read("supabase/legacy_pending/20261007_legacy_revoke_learner_question_keys.sql");
    expect(m).toContain("revoke select on public.questions from public, anon, authenticated");
    expect(readdirSync(resolve(process.cwd(), "supabase/migrations")).some((n) => n.includes("legacy_revoke"))).toBe(false);
  });
});

// ── question delete guard (fake PostgREST client) ───────────────────────────────────────────────
type Call = { table: string; op: string; ids?: string[] };
function fakeDb(attempts: { id: string; question_id: string }[], opts: { lookupError?: boolean } = {}) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      return {
        select() {
          let ids: string[] = []; let from = 0; let to = 0;
          const q = {
            in(_c: string, v: string[]) { ids = v; return q; },
            order() { return q; },
            range(a: number, b: number) {
              from = a; to = b;
              calls.push({ table, op: "select", ids });
              if (opts.lookupError) return Promise.resolve({ data: null, error: { message: "boom" } });
              const rows = attempts.filter((r) => ids.includes(r.question_id)).sort((x, y) => x.id.localeCompare(y.id));
              return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
            },
          };
          return q;
        },
        delete() {
          return { in(_c: string, v: string[]) { calls.push({ table, op: "delete", ids: v }); return Promise.resolve({ error: null }); } };
        },
      };
    },
  };
  return { db, calls };
}

describe("question delete guard", () => {
  it("requires the exact confirmation flag", () => {
    expect(attemptDeletionConfirmed({})).toBe(false);
    expect(attemptDeletionConfirmed({ confirm_delete_user_attempts: true })).toBe(false);
    expect(attemptDeletionConfirmed({ confirm_delete_user_attempts: CONFIRM_DELETE_USER_ATTEMPTS })).toBe(true);
    expect(partitionForDelete(["a", "b"], new Set(["b"]), false)).toEqual({ deletable: ["a"], retained: ["b"] });
  });

  it("by default retains questions with attempts and never deletes user_attempts", async () => {
    // q2 has 2500 attempts: the lookup must paginate past the 1000-row page to see it is used
    const attempts = [
      ...Array.from({ length: 2500 }, (_, i) => ({ id: `a${String(i).padStart(5, "0")}`, question_id: "q2" })),
      { id: "z1", question_id: "q3" },
    ];
    const { db, calls } = fakeDb(attempts);
    const r = await deleteQuestionsGuarded(db, ["q1", "q2", "q3", "q1"], false);
    expect(r).toEqual({ deleted: ["q1"], retained_with_attempts: ["q2", "q3"], attempts_deleted: false });
    expect(calls.filter((c) => c.table === "user_attempts" && c.op === "delete")).toEqual([]);
    expect(calls.find((c) => c.table === "questions" && c.op === "delete")?.ids).toEqual(["q1"]);
    expect(calls.filter((c) => c.table === "user_attempts" && c.op === "select").length).toBeGreaterThan(2);
  });

  it("fails closed: lookup error deletes nothing", async () => {
    const { db, calls } = fakeDb([], { lookupError: true });
    await expect(deleteQuestionsGuarded(db, ["q1"], false)).rejects.toThrow(/nothing deleted/);
    expect(calls.filter((c) => c.op === "delete")).toEqual([]);
  });

  it("explicit confirmation deletes attempts too", async () => {
    const { db, calls } = fakeDb([{ id: "a1", question_id: "q2" }]);
    const r = await deleteQuestionsGuarded(db, ["q2"], true);
    expect(r).toEqual({ deleted: ["q2"], retained_with_attempts: [], attempts_deleted: true });
    expect(calls.some((c) => c.table === "user_attempts" && c.op === "delete")).toBe(true);
  });
});
