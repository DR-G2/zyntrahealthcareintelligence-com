import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations_v2/0103_pie_mode_scoped_latest_observation_at.sql"),
  "utf8",
);

describe("authoritative mode-scoped observation timestamps", () => {
  it("attaches timestamps to every dimension within each explicit mode", () => {
    expect(migration).toContain("create or replace function pie._attach_mode_evidence_timestamps()");
    expect(migration).toContain("array['normal_mcq','amc_exam','nudge']");
    expect(migration).toContain("'capability','decision','timing','calibration','sustained_performance','learning'");
    expect(migration).toContain("'latest_observation_at', v_latest");
    expect(migration).toContain("o.provenance->>'practice_mode' = v_mode");
    expect(migration).toContain("max(o.observed_at)");
  });

  it("uses signal-specific validity predicates and does not query shadow inference", () => {
    expect(migration).toContain("o.payload->>'outcome' in ('CORRECT','INCORRECT')");
    expect(migration).toContain("v_dimension = 'timing'");
    expect(migration).toContain("v_dimension = 'decision'");
    expect(migration).toContain("v_dimension = 'calibration'");
    expect(migration).not.toMatch(/\b(?:from|join)\s+pie\.inference_(?:shadow|projection)\b/i);
  });

  it("keeps the change metadata-only and locks down the trigger function", () => {
    expect(migration).toContain("metadata-only trigger");
    expect(migration).toContain("revoke all on function pie._attach_mode_evidence_timestamps() from public, anon, authenticated, service_role");
    expect(migration).toContain("update pie.pie_candidate_state set state = state");
  });
});
