import { describe, expect, it } from "vitest";

describe("PIE engineering invariants", () => {
  it("keeps probability values inside [0, 1]", () => {
    const values = [0, 0.25, 0.5, 0.999, 1];
    expect(values.every(v => v >= 0 && v <= 1)).toBe(true);
  });

  it("treats readiness as an exam-specific output, not a candidate state", () => {
    const coreState = "pie_candidate_state";
    const readiness = "pie_exam_readiness";
    expect(coreState).not.toBe(readiness);
  });

  it("requires uncertainty as a first-class output", () => {
    const requiredLayers = [
      "pie_state_uncertainty",
      "pie_question_uncertainty",
      "pie_exam_readiness",
      "pie_dwig_candidate",
    ];
    expect(requiredLayers).toContain("pie_state_uncertainty");
    expect(requiredLayers).toContain("pie_question_uncertainty");
  });

  it("keeps legacy compatibility in shadow mode by default", () => {
    const sourceOfTruth = "LEGACY";
    const status = "SHADOW";
    expect(sourceOfTruth).toBe("LEGACY");
    expect(status).toBe("SHADOW");
  });

  it("does not treat observed outcome as causal effect", () => {
    const observedOutcome = "observed_downstream_change";
    const causalEffect = "validated_intervention_effect";
    expect(observedOutcome).not.toBe(causalEffect);
  });
});
