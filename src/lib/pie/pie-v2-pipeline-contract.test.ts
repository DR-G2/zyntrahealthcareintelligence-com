import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

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

  describe("migration 0044 (written against live V2)", () => {
    const migDir = "supabase/migrations_v2";
    const raw = read(`${migDir}/0044_pie_candidate_state_pipeline_repair.sql`);
    // Executable SQL only (line comments stripped) so prose cannot satisfy or trip assertions.
    const sql = raw
      .toLowerCase()
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n");

    it("does not clash with live migration numbers (old 0035 fix removed)", () => {
      const files = readdirSync(resolve(root, migDir));
      expect(files).not.toContain("0035_pie_candidate_state_pipeline_repair.sql");
      expect(files.filter((f) => f.startsWith("0044_"))).toEqual(["0044_pie_candidate_state_pipeline_repair.sql"]);
    });

    it("aborts before any change if live differs from the shape it was written for", () => {
      const preflightAt = sql.indexOf("0044 preflight");
      expect(preflightAt).toBeGreaterThan(-1);
      expect(preflightAt).toBeLessThan(sql.indexOf("insert into pie.pie_model_version"));
      expect(preflightAt).toBeLessThan(sql.indexOf("create or replace function"));
      // Exact live bodies (md5 of prosrc) of every function it replaces.
      for (const hash of ["d90edb259ef23e19992a3e200a1ae7cc", "ffda67ea63dbbf753b35291a09860a13", "f5d15bc6476ccf66c81a34853eaa39ee"]) {
        expect(sql).toContain(hash);
      }
    });

    it("public wrapper enforces auth.uid() is not null and auth.uid() = p_user_id", () => {
      expect(sql).toContain("create or replace function public.rebuild_candidate_state(p_user_id uuid)");
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
      const executable = raw.split("\n").map((line) => line.replace(/--.*$/, "")).join("\n");
      expect(executable).not.toMatch(/'SHADOW'|'COMPLETED'|'shadow'/);
      expect(sql).toContain("'active'");
      expect(sql).toContain("'completed'");
      expect(sql).toContain("on conflict (user_id) do update");
      expect(sql).toContain("state_version = cs.state_version + 1");
    });

    it("save_attempt logs PIE observation failures instead of swallowing them", () => {
      expect(sql).toContain("create or replace function public.save_attempt(");
      expect(sql).not.toContain("exception when others then null");
      expect(sql).toMatch(/exception when others then\s+raise warning 'save_attempt: pie observation not recorded/);
      // Attempt row is persisted before the PIE block, so PIE can never block persistence.
      expect(sql.indexOf("insert into public.user_attempts")).toBeLessThan(sql.indexOf("insert into pie.pie_observation"));
    });

    it("stops learners from self-reporting PIE observations", () => {
      expect(sql).toContain("revoke all on function pie.record_observation(text, jsonb, uuid, uuid, uuid) from public, anon, authenticated;");
      expect(sql).not.toMatch(/grant execute on function pie\.record_observation[^;]*authenticated/);
    });

    it("serves my_pie_state through an own-row SECURITY DEFINER reader, never via pie.* grants", () => {
      expect(sql).not.toContain("disable row level security");
      expect(sql).not.toMatch(/grant\s+[^;]*\bon\s+(table\s+)?pie\.pie_/);
      expect(sql).not.toMatch(/to\s+anon/);
      expect(sql).toContain("create or replace function public.get_my_pie_state()");
      expect(sql).toContain("s.user_id = auth.uid()");
      expect(sql).toContain("from public.get_my_pie_state();");
      expect(sql).toContain("revoke all on public.my_pie_state from public, anon, authenticated;");
      expect(sql).toContain("grant select on public.my_pie_state to authenticated;");
      expect(sql).toContain("with (security_invoker = true)");
    });

    it("keeps the my_pie_state columns the frontend selects", () => {
      const viewSelect = sql.slice(sql.indexOf("create or replace view public.my_pie_state"));
      for (const column of ["state_version", "state", "confidence", "calculated_at", "updated_at"]) {
        expect(viewSelect).toContain(column);
        expect(read("src/lib/pie/pie-state.ts")).toContain(column);
      }
    });
  });

  describe("live V2 drift capture", () => {
    const migDir = "supabase/migrations_v2";
    const manifest = read(`${migDir}/live_applied/LIVE_ORDER.tsv`)
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("\t"));

    it("lists every live migration in order with a repo file whose checksum matches live", () => {
      expect(manifest.length).toBe(57);
      const versions = manifest.map(([version]) => version);
      expect([...versions].sort()).toEqual(versions);
      for (const [, , file, sum] of manifest) {
        const actual = createHash("md5").update(readFileSync(resolve(root, migDir, file))).digest("hex");
        expect({ file, actual }).toEqual({ file, actual: sum });
      }
    });

    it("captures the live-only PIE boundary and 0035-0043 migrations", () => {
      const names = manifest.map(([, name]) => name);
      for (const name of ["0035_authenticated_practice_policies", "0040_harden_practice_attempt_boundary",
        "0043_security_invoker_remaining_views", "public_pie_rebuild_boundary", "expose_pie_rpc_schema"]) {
        expect(names).toContain(name);
      }
    });
  });
});
