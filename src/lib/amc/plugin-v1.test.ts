import { describe, expect, it } from "vitest";
import {
  AMC_PLUGIN_V1,
  toCandidateFacingDTO,
  type AMCExamEnvironment,
  type AMCReadinessOutput,
} from "./plugin-v1";

describe("AMC plugin v1 contract", () => {
  const environment: AMCExamEnvironment = {
    code: "AMC_CAT_MCQ",
    version: "2026.1",
    mode: "MCQ",
    blueprint: {},
    timing: { durationSeconds: 12600, adaptive: true },
    taskMix: {},
    difficultyDistribution: {},
    targetDefinition: { target: "exam_standard" },
    durationSeconds: 12600,
  };

  const readiness: AMCReadinessOutput = {
    plugin: "AMC",
    pluginVersion: AMC_PLUGIN_V1.version,
    environmentCode: environment.code,
    targetProbability: 0.62,
    lowerBound: 0.51,
    upperBound: 0.72,
    uncertaintyMeasure: 0.11,
    evidenceCount: 42,
    evidenceQuality: 0.84,
    identificationStatus: "PROVISIONALLY_IDENTIFIED",
    readinessStatus: "ESTIMATE_AVAILABLE",
    modelVersion: "1.0.0",
  };

  it("keeps AMC identity separate from PIE mathematics", () => {
    expect(AMC_PLUGIN_V1.code).toBe("AMC");
    expect(AMC_PLUGIN_V1.modelFamily).toBe("hierarchical_dynamic_state_space");
    expect(AMC_PLUGIN_V1.version).toBe("1.0.0");
  });

  it("requires uncertainty in readiness output", () => {
    expect(readiness.uncertaintyMeasure).not.toBeNull();
    expect(readiness.lowerBound).toBeLessThan(readiness.upperBound);
  });

  it("allows only the candidate-facing DTO shape", () => {
    const dto = toCandidateFacingDTO({ environment, readiness });

    expect(dto).toEqual({
      plugin: "AMC",
      pluginVersion: "1.0.0",
      examMode: "MCQ",
      environmentCode: "AMC_CAT_MCQ",
      readiness: {
        probability: 0.62,
        uncertainty: 0.11,
        status: "ESTIMATE_AVAILABLE",
      },
      evidence: {
        count: 42,
        quality: 0.84,
      },
      nextAction: undefined,
    });

    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("candidate_state");
    expect(serialized).not.toContain("question_posterior");
    expect(serialized).not.toContain("causal");
    expect(serialized).not.toContain("hypothesis");
  });
});
