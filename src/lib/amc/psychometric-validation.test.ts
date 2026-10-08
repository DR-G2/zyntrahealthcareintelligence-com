import { describe, expect, it } from "vitest";
import { simulateAMCResponseMatrix } from "./response-matrix-simulator";
import { calibrateRasch, evaluateHoldout, evaluatePromotionGate, DEFAULT_PROMOTION_CRITERIA } from "./psychometric-validation";

describe("AMC independent psychometric validation", () => {
  it("calibrates independently from the CAT simulator and evaluates a holdout", () => {
    const sim = simulateAMCResponseMatrix({ seed: 20261008, candidateCount: 120, questionPoolSize: 300, itemsPerCandidate: 150 });
    const holdout = sim.candidates.slice(96).map(c => c.id);
    const train = new Set(sim.candidates.slice(0, 96).map(c => c.id));
    const calibration = calibrateRasch(sim.attempts.filter(a => train.has(a.candidateId)), { maxIterations: 80 });
    const truth = Object.fromEntries(sim.candidates.map(c => [c.id, { theta: c.trueTheta, passed: c.trueTheta >= 0 }]));
    const metrics = evaluateHoldout(calibration, truth, holdout, sim.attempts.filter(a => holdout.includes(a.candidateId)));
    expect(calibration.iterations).toBeGreaterThan(0);
    expect(Object.keys(calibration.theta).length).toBe(96);
    expect(Object.keys(calibration.difficulty).length).toBeGreaterThan(100);
    expect(metrics.n).toBeGreaterThanOrEqual(20);
    expect(metrics.brier).toBeGreaterThanOrEqual(0);
    expect(metrics.brier).toBeLessThanOrEqual(1);
    expect(metrics.ece).toBeGreaterThanOrEqual(0);
    expect(metrics.ece).toBeLessThanOrEqual(1);
  });

  it("cannot promote without an approved dataset and independent calibration record", () => {
    const metrics = { n: 250, spearmanThetaVsTruth: 0.9, brier: 0.12, auc: 0.86, ece: 0.03, logLoss: 0.42 };
    const candidateTruth = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ["C" + i, { theta: 0, passed: i > 500 }]));
    const gate = evaluatePromotionGate({ datasetId: "synthetic-test", approvedForValidation: false, independentCalibration: false, attempts: [], candidateTruth }, metrics, DEFAULT_PROMOTION_CRITERIA);
    expect(gate.eligible).toBe(false);
    expect(gate.reasons).toContain("dataset_not_approved");
    expect(gate.reasons).toContain("independent_calibration_not_recorded");
  });

  it("defines a deterministic promotion contract once evidence prerequisites are satisfied", () => {
    const metrics = { n: 250, spearmanThetaVsTruth: 0.9, brier: 0.12, auc: 0.86, ece: 0.03, logLoss: 0.42 };
    const candidateTruth = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ["C" + i, { theta: 0, passed: i > 500 }]));
    const gate = evaluatePromotionGate({ datasetId: "approved-validation-fixture", approvedForValidation: true, independentCalibration: true, attempts: [], candidateTruth }, metrics);
    expect(gate.eligible).toBe(true);
    expect(gate.reasons).toEqual([]);
  });
});
