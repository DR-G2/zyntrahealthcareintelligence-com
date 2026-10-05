import { describe, expect, it } from "vitest";
import { AMC_EXTERNAL_VALIDATION_SOURCES, AMC_P7_REQUIRED_CHECKS } from "./p7-validation";

describe("AMC P8 certification contract", () => {
  it("uses official AMC specification sources", () => {
    expect(AMC_EXTERNAL_VALIDATION_SOURCES.amcSpecifications).toContain("amc.org.au");
    expect(AMC_EXTERNAL_VALIDATION_SOURCES.amcMcqSpecifications).toContain("amc.org.au");
    expect(AMC_EXTERNAL_VALIDATION_SOURCES.amcClinical).toContain("amc.org.au");
  });

  it("keeps independent psychometric validation distinct from AMC source validation", () => {
    expect(AMC_P7_REQUIRED_CHECKS).toContain("IRT_EXTERNAL_CROSS_CHECK");
    expect(AMC_P7_REQUIRED_CHECKS).toContain("AMC_MCq_BLUEPRINT");
  });

  it("does not treat an external website as certification", () => {
    expect(AMC_P7_REQUIRED_CHECKS).toContain("SYNTHETIC_TRUTH_RECOVERY");
    expect(AMC_P7_REQUIRED_CHECKS).toContain("SECURITY_BOUNDARY");
  });
});
