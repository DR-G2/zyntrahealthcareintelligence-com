import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

/**
 * Hank must-fixes for supabase/legacy_pending/20261007_legacy_revoke_learner_question_keys.sql:
 * allowlist (not denylist), every answer-revealing column hidden, frontend reads only allowlisted
 * columns, and no signed-out page reads legacy questions at all.
 */
const ROOT = process.cwd();
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const SQL = read("supabase/legacy_pending/20261007_legacy_revoke_learner_question_keys.sql");
const tempList = (name: string) => {
  const m = SQL.match(new RegExp(`insert into ${name} values([\\s\\S]*?);`));
  if (!m) throw new Error(`${name} not found`);
  return [...m[1].matchAll(/\('([a-z_]+)'\)/g)].map((x) => x[1]);
};
const ALLOW = tempList("_q_allow");
const MUST_HIDE = tempList("_q_must_hide");
const REQUIRED_HIDDEN = [
  "correct_answer", "explanation", "diagnosis_explanation", "best_treatment", "first_line_investigation",
  "gold_standard_investigation", "differential_diagnoses", "key_takeaways", "incorrect_answer_explanations",
  "guideline_reference", "tags",
];

// Every column of legacy public.questions known to the repo (generated types).
const typesSrc = read("src/integrations/supabase/types.ts");
const qRow = typesSrc.slice(typesSrc.indexOf("      questions: {"));
const QUESTION_COLUMNS = [...qRow.slice(qRow.indexOf("Row: {"), qRow.indexOf("Insert: {")).matchAll(/^\s{10}([a-z_]+)\??:/gm)].map((m) => m[1]);

describe("legacy revoke: allowlist", () => {
  it("is an allowlist; every answer-revealing column is hidden and asserted by name", () => {
    expect(SQL).toMatch(/grant select \(%s\) on public\.questions to authenticated/);
    expect(SQL).not.toMatch(/v_hidden|column_name <> all/);
    for (const c of REQUIRED_HIDDEN) {
      expect(ALLOW, c).not.toContain(c);
      expect(MUST_HIDE, c).toContain(c);
    }
    expect(ALLOW.filter((c) => MUST_HIDE.includes(c))).toEqual([]);
  });

  it("every repo column is classified: allowlisted ones are non-revealing, everything else hidden", () => {
    expect(QUESTION_COLUMNS.length).toBeGreaterThan(20);
    for (const c of ALLOW) expect(QUESTION_COLUMNS, c).toContain(c);
    const hidden = QUESTION_COLUMNS.filter((c) => !ALLOW.includes(c));
    expect(hidden.sort()).toEqual([...REQUIRED_HIDDEN].sort());
  });

  it("post-checks every hidden column for anon AND authenticated, plus leftover column grants", () => {
    const post = SQL.slice(SQL.indexOf("-- POSTCHECK BEGIN"), SQL.indexOf("-- POSTCHECK END"));
    expect(post).toMatch(/not in \(select col from _q_allow\)/);
    expect(post).toMatch(/has_column_privilege\('anon'/);
    expect(post).toMatch(/has_column_privilege\('authenticated'/);
    expect(post).toMatch(/aclexplode\(a\.attacl\)/);
    expect(post).toMatch(/has_table_privilege\('anon'/);
    expect(post).toMatch(/has_any_column_privilege\('anon'/);
    expect(post).toMatch(/raise exception/);
    // column-level grants are stripped too, not only the table-level one
    expect(SQL).toMatch(/revoke select \(%s\) on public\.questions from public, anon, authenticated/);
  });

  it("header: apply only after P5 is live (42501 for old builds) and has a read-only precheck block", () => {
    const header = SQL.slice(0, SQL.indexOf("begin;"));
    expect(header).toMatch(/ONLY AFTER the P5 frontend is live/);
    expect(header).toMatch(/42501/);
    const pre = header.slice(header.indexOf("-- PRECHECK BEGIN"), header.indexOf("-- PRECHECK END"));
    expect(pre.length).toBeGreaterThan(200);
    const sqlLines = pre.split("\n").map((l) => l.replace(/^-- ?/, "")).filter((l) => l && !l.startsWith("--"));
    expect(sqlLines.filter((l) => /^\s*(insert|update|delete|alter|grant|revoke|drop|create|truncate)\b/i.test(l))).toEqual([]);
  });
});

// ── frontend audit ─────────────────────────────────────────────────────────────────────────────
const SRC = resolve(ROOT, "src");
function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? resolve(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts", ""]) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile() && /\.tsx?$/.test(p)) return p;
  }
  return null;
}
function closure(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of readFileSync(f, "utf8").matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const r = resolveImport(f, m[1] || m[2]);
      if (r) stack.push(r);
    }
  }
  return seen;
}
// PostgREST embeds are written `questions(` with no space; prose like "questions (..." is not a read.
const LEGACY_Q_READ = /from\(\s*['"`]questions['"`]\s*\)|\bquestions\(\s*[a-z_*!]/;
const stripComments = (s: string) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

describe("legacy revoke: frontend audit", () => {
  it("no signed-out route (or the app shell) reads legacy questions", () => {
    const appPath = resolve(SRC, "App.tsx");
    const app = readFileSync(appPath, "utf8");
    const lazy = new Map([...app.matchAll(/const (\w+) = lazy\(\(\) => import\("([^"]+)"\)\)/g)].map((m) => [m[1], m[2]]));
    const staticImports = [...app.matchAll(/^import [^;]*?from ["']([^"']+)["']/gm)].map((m) => resolveImport(appPath, m[1])).filter(Boolean) as string[];
    const publicRoutes = [...app.matchAll(/<Route path="([^"]+)" element=\{(.*?)\} \/>/g)].filter((m) => !m[2].includes("ProtectedRoute"));
    expect(publicRoutes.map((m) => m[1])).toEqual(expect.arrayContaining(["/", "/check", "/login", "/blog/:slug", "/onboarding"]));
    const publicLazy = publicRoutes.flatMap((m) => [...m[2].matchAll(/<([A-Z]\w+)/g)].map((x) => x[1])).filter((n) => lazy.has(n))
      .map((n) => resolveImport(appPath, lazy.get(n)!)!);
    const files = closure([...staticImports, ...publicLazy]);
    expect(files.size).toBeGreaterThan(20);
    const hits = [...files].flatMap((f) => readFileSync(f, "utf8").split("\n").map((l, i) => ({ f, i, l }))
      .filter(({ l }) => LEGACY_Q_READ.test(l) && !/^\s*(\/\/|\*)/.test(l)).map(({ f, i, l }) => `${relative(ROOT, f)}:${i + 1}: ${l.trim()}`));
    expect(hits).toEqual([]);
    // protected pages are NOT in the signed-out closure
    expect([...files].some((f) => f.endsWith("pages/Practice.tsx"))).toBe(false);
  });

  it("every remaining client read of legacy questions uses allowlisted columns only", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "integrations" ? [] : walk(`${d}/${e.name}`)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [`${d}/${e.name}`] : []);
    const reads: { file: string; cols: string[] }[] = [];
    for (const f of walk(SRC)) {
      const s = stripComments(readFileSync(f, "utf8"));
      for (const m of s.matchAll(/from\(\s*['"`]questions['"`]\s*\)\s*\.select\(\s*['"`]([^'"`]*)['"`]/g)) reads.push({ file: relative(ROOT, f), cols: m[1].split(",").map((c) => c.trim()) });
      for (const m of s.matchAll(/\bquestions\(\s*([a-z_*][a-z_,\s*]*)\)/g)) reads.push({ file: relative(ROOT, f), cols: m[1].split(",").map((c) => c.trim()) });
      expect(LEGACY_Q_READ.test(s) ? reads.some((r) => r.file === relative(ROOT, f)) : true, `unparsed legacy read in ${f}`).toBe(true);
    }
    expect(reads.map((r) => r.file).sort()).toEqual(["src/lib/mcp/tools/get-subject-breakdown.ts", "src/lib/mcp/tools/list-recent-attempts.ts", "src/pages/Practice.tsx"]);
    for (const r of reads) for (const c of r.cols) expect(ALLOW, `${r.file} reads ${c}`).toContain(c);
  });
});

describe("admin_roles lowercase migration", () => {
  it("normalises, constrains, and lower-cases both sides of the SQL helpers", () => {
    const m = read("supabase/legacy_pending/20261007_legacy_admin_roles_email_lowercase.sql");
    expect(m).toMatch(/check \(email = lower\(btrim\(email\)\)\)/);
    expect(m).toMatch(/duplicate emails under lower-case/);
    expect(m).toMatch(/lower\(email\) = lower\(btrim\(_email\)\)/);
    expect(m).toMatch(/lower\(email\) = lower\(btrim\(auth\.jwt\(\) ->> 'email'\)\)/);
    expect(m).toMatch(/-- PRECHECK BEGIN/);
    expect(existsSync(resolve(ROOT, "supabase/migrations/20261007_legacy_admin_roles_email_lowercase.sql"))).toBe(false);
  });
});
