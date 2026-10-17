import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations_v2/0094_authoritative_pie_dimension_evidence.sql", import.meta.url),
  "utf8",
);

describe("authoritative PIE dimension evidence migration contract", () => {
  it("enriches authoritative candidate state from observations, never shadow projections", () => {
    expect(migration).toContain("pie.pie_candidate_state");
    expect(migration).toContain("pie.pie_observation");
    expect(migration).toContain("create trigger pie_candidate_state_dimension_evidence");
    expect(migration).not.toMatch(/\b(?:from|join)\s+pie\.inference_(?:shadow|projection)\b/i);
  });

  it("persists per-dimension counts, quality, uncertainty and bounded intervals", () => {
    for (const field of ["evidence_count", "evidence_quality", "uncertainty", "lower", "upper"]) {
      expect(migration).toContain(`'${field}'`);
    }
    expect(migration).toContain("ln(40::numeric)");
    expect(migration).toContain("ln(80::numeric)");
    expect(migration).toContain("greatest(0::numeric, p_estimate - v_radius)");
    expect(migration).toContain("least(1::numeric, p_estimate + v_radius)");
  });

  it("preserves existing estimates and keeps internal helper functions private", () => {
    expect(migration).toContain("Existing estimates remain unchanged");
    expect(migration).toContain("revoke all on function pie._authoritative_dimension_evidence(uuid,text,numeric) from public, anon, authenticated, service_role");
    expect(migration).toContain("revoke all on function pie._attach_authoritative_dimension_evidence() from public, anon, authenticated, service_role");
    expect(migration).toContain("update pie.pie_candidate_state set state = state");
  });
});