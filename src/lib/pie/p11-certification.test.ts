import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PIE P11 certification contracts", () => {
  it("contains no automatic promotion path", () => {
    const runtime = readFileSync(resolve(process.cwd(), "src/lib/pie/runtime/orchestrator.ts"), "utf8");
    expect(runtime).toContain('input.mode === "CERTIFIED"');
    expect(runtime).toContain("candidateFacing: false");
  });

  it("requires explicit certification evidence for promotion", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261005042000_pie_p10_shadow.sql"), "utf8");
    expect(migration).toContain("candidate_facing BOOLEAN NOT NULL DEFAULT false");
    const certification = readFileSync(resolve(process.cwd(), "supabase/migrations/20261005043000_pie_p11_certification.sql"), "utf8");
    expect(certification).toContain("LEVEL_2_DECISION");
    expect(certification).toContain("status='PASSED'");
  });
});
