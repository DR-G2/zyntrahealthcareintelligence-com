import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { normaliseEmail, isExactAdminRow, clampPage } from "../../../supabase/functions/admin-question-bank/policy";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Hank B1/B2: server-checked admin paths", () => {
  it("exact case-insensitive admin match, no wildcard semantics", () => {
    expect(normaliseEmail("  Admin@Zyntra.COM ")).toBe("admin@zyntra.com");
    expect(isExactAdminRow({ email: "Admin@zyntra.com" }, "admin@zyntra.com")).toBe(true);
    expect(isExactAdminRow({ email: "a%@zyntra.com" }, "abc@zyntra.com")).toBe(false);
    expect(isExactAdminRow({ email: "a_c@zyntra.com" }, "abc@zyntra.com")).toBe(false);
    expect(isExactAdminRow(null, "abc@zyntra.com")).toBe(false);
    expect(isExactAdminRow({ email: "abc@zyntra.com" }, null)).toBe(false);
  });

  it("pages are clamped", () => {
    expect(clampPage(-5, 99999)).toEqual({ from: 0, to: 999 });
    expect(clampPage(2000, 10)).toEqual({ from: 2000, to: 2009 });
  });

  it("admin-question-bank checks admin_roles server-side with .eq before reading questions", () => {
    const src = read("supabase/functions/admin-question-bank/index.ts");
    expect(src).toContain('.from("admin_roles").select("role, email").eq("email", email)');
    expect(src.indexOf("isExactAdminRow(role, email)")).toBeLessThan(src.indexOf('.from("questions")'));
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

  it("admin functions restrict CORS to the app origin (except the two untouched delete functions)", () => {
    const dir = resolve(process.cwd(), "supabase/functions");
    for (const f of readdirSync(dir).filter((n) => n.startsWith("admin-") && !["admin-manage-questions", "admin-cleanup-questions"].includes(n))) {
      expect(read(`supabase/functions/${f}/index.ts`), f).not.toContain('"Access-Control-Allow-Origin": "*"');
    }
  });

  it("legacy key revoke is prepared outside the auto-applied migrations folder", () => {
    const m = read("supabase/legacy_pending/20261007_legacy_revoke_learner_question_keys.sql");
    expect(m).toContain("revoke select on public.questions from anon, authenticated");
    expect(m).toContain("'correct_answer', 'explanation'");
  });
});
