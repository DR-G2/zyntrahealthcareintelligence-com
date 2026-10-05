import { describe, expect, it } from "vitest";
import { runFullSystemValidation } from "./full-system";

describe("PIE P8 full-system validation", () => {
  it("passes the cross-layer safety and provenance gates", () => {
    const result = runFullSystemValidation();

    expect(result.candidateStatePresent).toBe(true);
    expect(result.questionProtectionWorks).toBe(true);
    expect(result.dwigSelectsOnlyEligibleQuestion).toBe(true);
    expect(result.runtimePreservesUncertainty).toBe(true);
    expect(result.runtimeIsNotCandidateFacing).toBe(true);
    expect(result.certifiedPromotionRequiresEligibleQuestion).toBe(true);
    expect(result.interventionRequiresValidatedEvidence).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("does not expose a composite readiness score", () => {
    const result = runFullSystemValidation();
    expect("readinessScore" in result).toBe(false);
    expect("compositeScore" in result).toBe(false);
  });
});
