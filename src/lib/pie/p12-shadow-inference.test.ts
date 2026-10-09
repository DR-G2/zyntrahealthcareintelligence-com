import { describe, expect, it } from "vitest";
import { DEFAULT_INFERENCE_CONFIG, initialCandidateState, updateCandidateState } from "./inference";

describe("PIE P12 shadow inference", () => {
  it("produces all six inference dimensions with bounded uncertainty", () => {
    const config = { ...DEFAULT_INFERENCE_CONFIG, modelVersion: "pie-inference-v2.1-shadow" };
    let state = initialCandidateState("2026-10-08T00:00:00.000Z", config);
    for (let i = 0; i < 12; i++) {
      state = updateCandidateState(state, {
        occurredAt: `2026-10-08T00:00:${String(i).padStart(2, "0")}.000Z`,
        outcome: i % 3 === 0 ? "INCORRECT" : "CORRECT",
        confidenceNormalized: i % 3 === 0 ? 0.9 : 0.7,
        timeTotalMs: 30000 + i * 1000,
        firstAnswerCorrect: i % 4 !== 0,
        finalAnswerCorrect: i % 3 !== 0,
        answerChanges: i % 4 === 0 ? 1 : 0,
        difficulty: 0.5,
        discrimination: 1,
        observationQuality: "VALID",
        learningContext: "NOVEL",
      }, config);
    }

    for (const posterior of [
      state.capability,
      state.decision,
      state.timing,
      state.calibration,
      state.sustainedPerformance,
      state.learning,
    ]) {
      expect(posterior.estimate).toBeGreaterThanOrEqual(0);
      expect(posterior.estimate).toBeLessThanOrEqual(1);
      expect(posterior.variance).toBeGreaterThan(0);
      expect(posterior.lower).toBeGreaterThanOrEqual(0);
      expect(posterior.upper).toBeLessThanOrEqual(1);
      expect(posterior.evidenceCount).toBeGreaterThan(0);
    }

    expect(state.modelVersion).toBe("pie-inference-v2.1-shadow");
    expect(state.identificationStatus).toBeDefined();
    expect(state.evidenceLevel).toBeDefined();
  });

  it("is deterministic for the same evidence sequence", () => {
    const config = { ...DEFAULT_INFERENCE_CONFIG, modelVersion: "pie-inference-v2.1-shadow" };
    const observations = Array.from({ length: 10 }, (_, i) => ({
      occurredAt: `2026-10-08T01:00:${String(i).padStart(2, "0")}.000Z`,
      outcome: i % 2 ? "CORRECT" as const : "INCORRECT" as const,
      confidenceNormalized: 0.6,
      timeTotalMs: 25000,
      observationQuality: "VALID" as const,
      learningContext: "IMMEDIATE_TRANSFER" as const,
    }));

    const run = () => observations.reduce(
      (state, observation) => updateCandidateState(state, observation, config),
      undefined as ReturnType<typeof initialCandidateState> | undefined,
    );

    expect(run()).toEqual(run());
  });
});
