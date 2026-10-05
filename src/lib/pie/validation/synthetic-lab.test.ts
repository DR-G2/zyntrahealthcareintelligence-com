import { describe, expect, it } from "vitest";
import { makeDataset } from "./synthetic";
import { brierScore, calibrationBins, spearman, uncertaintyWidth } from "./metrics";
import { estimateCandidateState, estimateOutcomeProbability } from "./candidate-model";

describe("PIE synthetic validation lab", () => {
  it("001 capability recovery: deterministic generator preserves signal", () => {
    const dataset = makeDataset(1001);
    const byCandidate = dataset.candidates.map(candidate => {
      const rows = dataset.observations.filter(o => o.candidateId === candidate.id && !o.missing);
      return {
        truth: candidate.capability,
        observed: rows.reduce((s, o) => s + Number(o.outcome), 0) / rows.length,
      };
    });

    const rho = spearman(byCandidate.map(x => x.truth), byCandidate.map(x => x.observed));
    expect(rho).toBeGreaterThan(0.65);
  });

  it("002 timing separation: time pressure changes outcomes independently of capability", () => {
    const dataset = makeDataset(1002);
    const low = dataset.observations.filter(o => o.timePressure < 0.35 && !o.missing);
    const high = dataset.observations.filter(o => o.timePressure > 0.70 && !o.missing);
    const lowRate = low.reduce((s, o) => s + Number(o.outcome), 0) / low.length;
    const highRate = high.reduce((s, o) => s + Number(o.outcome), 0) / high.length;

    expect(low.length).toBeGreaterThan(50);
    expect(high.length).toBeGreaterThan(50);
    expect(lowRate - highRate).toBeGreaterThan(0.03);
  });

  it("003 decision separation: answer-change behaviour is observable", () => {
    const dataset = makeDataset(1003);
    const changed = dataset.observations.filter(o => o.answerChanged && !o.missing);
    const unchanged = dataset.observations.filter(o => !o.answerChanged && !o.missing);

    expect(changed.length).toBeGreaterThan(50);
    expect(unchanged.length).toBeGreaterThan(50);

    const changedFinalRate = changed.reduce((s, o) => s + Number(o.finalCorrect), 0) / changed.length;
    const unchangedFinalRate = unchanged.reduce((s, o) => s + Number(o.finalCorrect), 0) / unchanged.length;
    expect(Math.abs(changedFinalRate - unchangedFinalRate)).toBeGreaterThan(0.005);
  });

  it("004 calibration recovery: confidence is evaluated separately from accuracy", () => {
    const dataset = makeDataset(1004);
    const rows = dataset.observations.filter(o => !o.missing);
    const probabilities = rows.map(o => o.confidence);
    const outcomes = rows.map(o => Number(o.outcome));
    const brier = brierScore(probabilities, outcomes);
    const bins = calibrationBins(probabilities, outcomes);

    expect(Number.isFinite(brier)).toBe(true);
    expect(bins.some(b => b.count > 0)).toBe(true);
    expect(brier).toBeLessThan(0.45);
  });

  it("005 missing-data uncertainty robustness: less evidence widens uncertainty", () => {
    const dataset = makeDataset(1005);
    const full = dataset.observations.filter(o => !o.missing);
    const sparse = full.filter((_, i) => i % 4 === 0);

    const fullState = estimateCandidateState(full);
    const sparseState = estimateCandidateState(sparse);

    const fullWidth = uncertaintyWidth(
      fullState.capability - fullState.uncertainty.capability / 2,
      fullState.capability + fullState.uncertainty.capability / 2,
    );
    const sparseWidth = uncertaintyWidth(
      sparseState.capability - sparseState.uncertainty.capability / 2,
      sparseState.capability + sparseState.uncertainty.capability / 2,
    );

    expect(sparseState.evidenceCount).toBeLessThan(fullState.evidenceCount);
    expect(sparseWidth).toBeGreaterThan(fullWidth);
  });

  it("development model exposes a probability function without a readiness score", () => {
    const p = estimateOutcomeProbability(0.8, 0.4, 1.2);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1);
  });
});
