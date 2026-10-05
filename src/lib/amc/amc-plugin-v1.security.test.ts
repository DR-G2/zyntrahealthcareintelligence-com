import { describe, expect, it } from "vitest";
import { AMC_PLUGIN_SECURITY_RULES } from "./index";

describe("AMC Plugin v1 security boundary", () => {
  it("keeps internal intelligence server-side", () => {
    expect(AMC_PLUGIN_SECURITY_RULES.candidateDirectDbRead).toBe(false);
    expect(AMC_PLUGIN_SECURITY_RULES.candidateDirectDbWrite).toBe(false);
    expect(AMC_PLUGIN_SECURITY_RULES.candidateReadsModelParameters).toBe(false);
    expect(AMC_PLUGIN_SECURITY_RULES.candidateReadsQuestionPosteriors).toBe(false);
    expect(AMC_PLUGIN_SECURITY_RULES.candidateReadsDwig).toBe(false);
    expect(AMC_PLUGIN_SECURITY_RULES.candidateReadsCausalEstimates).toBe(false);
    expect(AMC_PLUGIN_SECURITY_RULES.candidateReadsOtherCandidates).toBe(false);
    expect(AMC_PLUGIN_SECURITY_RULES.serviceRoleOnlyInternalPersistence).toBe(true);
  });
});
