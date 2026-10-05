import {describe,expect,it} from "vitest";
import {AMC_PLUGIN_V1,AMC_MCQ_ENVIRONMENT_V1,AMC_PLUGIN_SECURITY_RULES,assertAmcPluginVersion,emptyAmcReadiness} from "./index";
describe("AMC Exam Intelligence Plugin v1",()=>{
 it("uses a versioned exam-specific contract",()=>{assertAmcPluginVersion(AMC_PLUGIN_V1);expect(AMC_PLUGIN_V1.pluginVersion).toBe("1.0.0");expect(AMC_PLUGIN_V1.examCode).toBe("AMC");expect(AMC_MCQ_ENVIRONMENT_V1.environmentKey).toBe("AMC_MCQ");});
 it("does not invent official blueprint values",()=>{expect(AMC_MCQ_ENVIRONMENT_V1.blueprintVersion).toContain("UNPOPULATED");expect(AMC_MCQ_ENVIRONMENT_V1.taskMixVersion).toContain("UNPOPULATED");});
 it("enforces the security contract",()=>{expect(AMC_PLUGIN_SECURITY_RULES.candidateDirectDbRead).toBe(false);expect(AMC_PLUGIN_SECURITY_RULES.candidateReadsQuestionPosteriors).toBe(false);expect(AMC_PLUGIN_SECURITY_RULES.candidateReadsDwig).toBe(false);expect(AMC_PLUGIN_SECURITY_RULES.candidateReadsOtherCandidates).toBe(false);});
 it("does not expose readiness before validated inference",()=>{expect(emptyAmcReadiness("amc-plugin-1.0.0").readinessStatus).toBe("NOT_READY_FOR_INFERENCE");});
});
