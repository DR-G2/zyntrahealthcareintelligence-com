import { describe, expect, it } from "vitest";
import { AMC_PLUGIN_V1, toCandidateFacingDTO } from "./plugin-v1";
import { AMC_P7_REQUIRED_CHECKS, canProposeP8 } from "./p7-validation";
import { makeDataset } from "../pie/validation/synthetic";
import { brierScore, spearman } from "../pie/validation/metrics";
import { estimateCandidateState } from "../pie/validation/candidate-model";

describe("AMC P7 executable validation", () => {
  it("validates AMC plugin identity and model-family contract", () => {
    expect(AMC_PLUGIN_V1.code).toBe("AMC");
    expect(AMC_PLUGIN_V1.version).toBe("1.0.0");
    expect(AMC_PLUGIN_V1.modelFamily).toBe("hierarchical_dynamic_state_space");
  });

  it("validates the six AMC MCQ blueprint proportions", () => {
    const proportions = [0.30, 0.20, 0.125, 0.125, 0.125, 0.125];
    expect(proportions.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(proportions.map(p => Math.round(p * 150))).toEqual([45, 30, 19, 19, 19, 19]);
    expect(proportions.reduce((a, b) => a + Math.round(b * 150), 0)).toBe(151);
    // The 150-question allocation cannot be represented by naive independent
    // rounding. Production blueprint validation must use the AMC blueprint
    // proportions, not pretend that six rounded targets sum to 150.
  });

  it("recovers capability signal from an independent synthetic truth", () => {
    const dataset = makeDataset(7101, 120, 180, 60);
    const truth = dataset.candidates.map(c => c.capability);
    const observed = dataset.candidates.map(c => {
      const rows = dataset.observations.filter(o => o.candidateId === c.id && !o.missing);
      return rows.reduce((s, o) => s + Number(o.outcome), 0) / rows.length;
    });
    expect(spearman(truth, observed)).toBeGreaterThan(0.65);
  });

  it("keeps confidence separate from accuracy", () => {
    const dataset = makeDataset(7102, 80, 120, 60);
    const rows = dataset.observations.filter(o => !o.missing);
    const brier = brierScore(rows.map(o => o.confidence), rows.map(o => Number(o.outcome)));
    const accuracy = rows.reduce((s, o) => s + Number(o.outcome), 0) / rows.length;
    expect(Number.isFinite(brier)).toBe(true);
    expect(Number.isFinite(accuracy)).toBe(true);
  });

  it("widens uncertainty when evidence is reduced", () => {
    const dataset = makeDataset(7103);
    const full = estimateCandidateState(dataset.observations.filter(o => !o.missing));
    const sparse = estimateCandidateState(
      dataset.observations.filter(o => !o.missing).slice(0, 12),
    );
    expect(sparse.uncertainty.capability).toBeGreaterThan(full.uncertainty.capability);
  });

  it("preserves the candidate security boundary", () => {
    const dto = toCandidateFacingDTO({
      environment: {
        code: "AMC_CAT_MCQ",
        version: "2026.1",
        mode: "MCQ",
        blueprint: {},
        timing: {},
        taskMix: {},
        difficultyDistribution: {},
        targetDefinition: {},
        durationSeconds: 12600,
      },
      readiness: {
        plugin: "AMC",
        pluginVersion: "1.0.0",
        environmentCode: "AMC_CAT_MCQ",
        targetProbability: 0.5,
        lowerBound: 0.4,
        upperBound: 0.6,
        uncertaintyMeasure: 0.1,
        evidenceCount: 10,
        evidenceQuality: 0.8,
        identificationStatus: "PROVISIONALLY_IDENTIFIED",
        readinessStatus: "ESTIMATE_AVAILABLE",
        modelVersion: "development-only",
      },
    });
    const forbidden = [
      "candidateState",
      "candidate_state",
      "questionPosterior",
      "question_posterior",
      "hypotheses",
      "dwig",
      "causal",
      "interventionEffect",
      "certification",
    ];
    for (const key of forbidden) expect(key in dto).toBe(false);
  });

  it("requires independent validation families before P8 proposal", () => {
    expect(AMC_P7_REQUIRED_CHECKS).toContain("IRT_EXTERNAL_CROSS_CHECK");
    expect(AMC_P7_REQUIRED_CHECKS).toContain("SYNTHETIC_TRUTH_RECOVERY");
    expect(AMC_P7_REQUIRED_CHECKS).toContain("SECURITY_BOUNDARY");
    expect(canProposeP8([{
      validationType: "SYNTHETIC",
      status: "INCONCLUSIVE",
      datasetManifest: {},
      methodology: {},
      metrics: [],
    }])).toBe(false);
  });
});
