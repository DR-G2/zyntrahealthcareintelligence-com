import { describe, expect, test } from "vitest";
import {
  initialCandidateState,
  updateCandidateState,
  updateCandidateStateSequence,
  evaluateIdentifiability,
  deriveDynamics,
} from "./inference";

describe("PIE P3 state inference engine", () => {
  test("starts with uncertainty instead of false certainty", () => {
    const state = initialCandidateState();
    expect(state.capability.variance).toBeGreaterThan(0);
    expect(state.identificationStatus).toBe("UNRESOLVED");
  });

  test("updates capability without collapsing uncertainty to zero", () => {
    let state = initialCandidateState();
    for (let i=0;i<20;i++) {
      state = updateCandidateState(state, {
        outcome: i % 3 === 0 ? "INCORRECT" : "CORRECT",
        difficulty: 0.5,
        discrimination: 1,
        observationQuality: "VALID",
      });
    }
    expect(state.capability.evidenceCount).toBe(20);
    expect(state.capability.variance).toBeGreaterThan(0);
    expect(state.capability.lower).toBeLessThanOrEqual(state.capability.estimate);
    expect(state.capability.upper).toBeGreaterThanOrEqual(state.capability.estimate);
  });

  test("missing confidence does not create calibration failure", () => {
    const state = updateCandidateState(initialCandidateState(), {
      outcome: "CORRECT",
      confidenceNormalized: null,
    });
    expect(state.calibration.evidenceCount).toBe(0);
  });

  test("invalid confidence and timing are unavailable, not clamped into evidence", () => {
    const before = initialCandidateState();
    const after = updateCandidateState(before, {
      outcome: "CORRECT",
      confidenceNormalized: 1.4,
      timeTotalMs: Number.NaN,
      timePressure: 1.5,
      difficulty: 1.8,
    });
    expect(after.calibration.evidenceCount).toBe(0);
    expect(after.timing.evidenceCount).toBe(0);
    expect(after.capability.evidenceCount).toBe(0);
    expect(after.capability.estimate).toBe(before.capability.estimate);
    expect(after.capability.variance).toBe(before.capability.variance);
  });

  test("an observation with no valid signals cannot increase evidence or data quality", () => {
    const before = initialCandidateState();
    const after = updateCandidateState(before, {
      outcome: "UNKNOWN",
      confidenceNormalized: null,
      timeTotalMs: -100,
      timePressure: Number.POSITIVE_INFINITY,
    });
    expect(after.capability.evidenceCount).toBe(0);
    expect(after.timing.evidenceCount).toBe(0);
    expect(after.calibration.evidenceCount).toBe(0);
    expect(after.dataQuality).toBe(before.dataQuality);
  });

  test("unusable and contradictory observations do not update posterior estimates", () => {
    const before = initialCandidateState();
    const after = updateCandidateState(before, {
      outcome: "CORRECT",
      confidenceNormalized: 0.9,
      timeTotalMs: 5000,
      observationQuality: "CONTRADICTORY",
    });
    expect(after.capability.evidenceCount).toBe(0);
    expect(after.calibration.evidenceCount).toBe(0);
    expect(after.timing.evidenceCount).toBe(0);
    expect(after.capability.estimate).toBe(before.capability.estimate);
  });

  test("technical interruption reduces observation quality rather than capability directly", () => {
    const before = initialCandidateState();
    const after = updateCandidateState(before, {
      outcome: "INCORRECT",
      observationQuality: "VALID",
      interruptionActive: true,
    });
    expect(after.capability.evidenceCount).toBe(1);
    expect(after.capability.variance).toBeGreaterThan(0);
    expect(after.dataQuality).toBeLessThan(1);
  });

  test("state dimensions remain separate", () => {
    const state = updateCandidateState(initialCandidateState(), {
      outcome: "CORRECT",
      confidenceNormalized: 0.9,
      timeTotalMs: 4000,
      timePressure: 0.2,
      firstAnswerCorrect: true,
      finalAnswerCorrect: true,
    });
    expect(state.capability.estimate).toBeDefined();
    expect(state.decision.estimate).toBeDefined();
    expect(state.timing.estimate).toBeDefined();
    expect(state.calibration.estimate).toBeDefined();
    expect(state.sustainedPerformance.estimate).toBeDefined();
    expect(state.learning.estimate).toBeDefined();
  });

  test("dynamics and competing hypotheses are separate outputs", () => {
    const history = updateCandidateStateSequence(
      Array.from({length: 30}, (_,i)=>({
        outcome: i<10 ? "CORRECT" : i<20 ? "INCORRECT" : "CORRECT",
        difficulty: 0.5,
        discrimination: 1,
        timePressure: i/29,
        confidenceNormalized: 0.6,
        firstAnswerCorrect: true,
        finalAnswerCorrect: i%4===0 ? false : true,
      })),
    );
    const dynamics = deriveDynamics(history);
    const identification = evaluateIdentifiability(history.at(-1)!, []);
    expect(dynamics.evidenceCount).toBe(30);
    expect(identification.status).toBeDefined();
  });

  test("no readiness score is produced", () => {
    const state = updateCandidateState(initialCandidateState(), {
      outcome: "CORRECT",
      difficulty: 0.5,
    });
    expect(state).not.toHaveProperty("readiness");
    expect(state).not.toHaveProperty("readinessScore");
  });
});
