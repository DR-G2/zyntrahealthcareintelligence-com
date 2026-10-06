import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(resolve(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(resolve(root, path)).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("PIE V2 production pipeline contract", () => {
  it("browser code never calls the internal pie schema", () => {
    const offenders = sourceFiles("src").filter((file) => /\.schema\(\s*['"]pie['"]\s*\)/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it("all browser rebuild callers use the public authenticated wrapper", () => {
    const callers = sourceFiles("src").filter((file) => read(file).includes("rebuild_candidate_state"));
    expect(callers.sort()).toEqual(["src/lib/migration/v2-practice-session.ts", "src/lib/pie/pie-state.ts"].sort());
    for (const file of callers) {
      expect(read(file)).toMatch(/\.rpc\(\s*['"]rebuild_candidate_state['"]/);
    }
  });

  it("the production Performance Intelligence page no longer uses Awaiting Signal", () => {
    expect(read("src/pages/Intelligence.tsx")).toContain("PerformanceIntelligenceV2");
    expect(read("src/pages/PerformanceIntelligenceV2.tsx").toLowerCase()).not.toContain("awaiting signal");
  });

  it("Assess and Practice trigger the production PIE sync, not the removed shadow helper", () => {
    for (const file of ["src/pages/Assess.tsx", "src/pages/Practice.tsx"]) {
      const source = read(file);
      expect(source).toContain("syncPieEngine()");
      expect(source).not.toContain("syncPieShadow");
    }
  });

  describe("migration 0035", () => {
    // Executable SQL only (line comments stripped) so prose cannot satisfy or trip assertions.
    const sql = read("supabase/migrations_v2/0035_pie_candidate_state_pipeline_repair.sql")
      .toLowerCase()
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n");

    it("public wrapper enforces auth.uid() is not null and auth.uid() = p_user_id", () => {
      expect(sql).toContain("create function public.rebuild_candidate_state(p_user_id uuid)");
      expect(sql).toContain("if auth.uid() is null then");
      expect(sql).toContain("auth.uid() <> p_user_id");
      expect(sql).toContain("grant execute on function public.rebuild_candidate_state(uuid) to authenticated, service_role;");
    });

    it("internal rebuild is not executable by browsers and uses a pinned search_path", () => {
      expect(sql).toContain("revoke all on function pie.rebuild_candidate_state(uuid) from public, anon, authenticated;");
      expect(sql).toContain("grant execute on function pie.rebuild_candidate_state(uuid) to service_role;");
      expect(sql).not.toMatch(/grant execute on function pie\.rebuild_candidate_state\(uuid\) to [^;]*authenticated/);
      expect(sql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(3);
    });

    it("fixes the persisted-state defects (status case and one-row-per-user upsert)", () => {
      expect(sql).not.toContain("'shadow',jsonb");
      expect(sql).toContain("'active'");
      expect(sql).toContain("'completed'");
      expect(sql).toContain("on conflict (user_id) do update");
      expect(sql).toContain("state_version = cs.state_version + 1");
    });

    it("never weakens RLS or grants learners access to internal PIE tables", () => {
      expect(sql).not.toContain("disable row level security");
      expect(sql).not.toMatch(/grant\s+[^;]*\bon\s+(table\s+)?pie\.pie_/);
      expect(sql).not.toMatch(/to\s+anon/);
      expect(sql).toContain("revoke all on public.my_pie_state from public, anon, authenticated;");
      expect(sql).toContain("with (security_invoker = true)");
      expect(sql).toContain("s.user_id = auth.uid()");
    });
  });
});
