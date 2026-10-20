import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations_v2/0103_pie_mode_scoped_latest_observation_at.sql"),
  "utf8",
);

describe("authoritative mode-scoped observation timestamps", () => {
  it("adds latest timestamps to each mode-specific dimension without changing the estimator", () => {
    expect(migration).toContain("create or replace function pie._authoritative_mode_evidence(p_user_id uuid, p_mode text)");
    expect(migration).toContain("'latest_observation_at', v_latest");
    expect(migration).toContain("o.provenance->>'practice_mode' = p_mode");
    expect(migration).toContain("max(o.observed_at)");
    expect(migration).toContain("o.payload->>'outcome' in ('CORRECT','INCORRECT')");
    expect(migration).toContain("v_dimension = 'timing'");
    expect(migration).toContain("v_dimension = 'decision'");
    expect(migration).toContain("v_dimension = 'calibration'");
  });

  it("preserves the existing estimate formula and shadow-inference isolation", () => {
    expect(migration).toContain("v_mean := 1 - abs(coalesce(v_confidence_mean, 0.5::numeric) - coalesce(v_calibration_outcome_mean, 0::numeric))");
    expect(migration).toContain("round(v_mean, 4)");
    expect(migration).not.toMatch(/\\b(?:from|join)\\s+pie\\.inference_(?:shadow|projection)\\b/i);
    expect(migration).toContain("update pie.pie_candidate_state set state = state");
  });

  it("computes timestamps independently for each mode and dimension", () => {
    expect(migration).toContain("foreach v_mode in array array['normal_mcq','amc_exam','nudge']");
    expect(migration).toContain("foreach v_dimension in array array[");
    expect(migration).toContain("'latest_observation_at', v_latest");
  });
});
