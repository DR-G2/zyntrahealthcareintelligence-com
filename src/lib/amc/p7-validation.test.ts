import { describe, expect, it } from "vitest";
import { AMC_P7_REQUIRED_CHECKS, canProposeP8 } from "./p7-validation";

describe("AMC P7 validation contract", () => {
  it("requires independent and internal validation families", () => {
    expect(AMC_P7_REQUIRED_CHECKS).toContain("IRT_EXTERNAL_CROSS_CHECK");
    expect(AMC_P7_REQUIRED_CHECKS).toContain("SYNTHETIC_TRUTH_RECOVERY");
    expect(AMC_P7_REQUIRED_CHECKS).toContain("SECURITY_BOUNDARY");
  });

  it("does not propose certification from inconclusive evidence", () => {
    expect(canProposeP8([{
      validationType: "PSYCHOMETRIC_EXTERNAL",
      status: "INCONCLUSIVE",
      datasetManifest: {},
      methodology: {},
      metrics: [],
    }])).toBe(false);
  });

  it("requires every recorded metric to pass before proposing P8", () => {
    expect(canProposeP8([{
      validationType: "SYNTHETIC",
      status: "PASSED",
      datasetManifest: {},
      methodology: {},
      metrics: [{ code: "truth_recovery", direction: "HIGHER_IS_BETTER", status: "FAIL" }],
    }])).toBe(false);
  });
});
