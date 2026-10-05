import { describe, expect, it } from "vitest";
import { legacyBaseline, pieCandidateBaseline } from "./baselines";
import { makeDataset } from "./synthetic";

describe("PIE model comparison harness", () => {
  it("compares legacy and PIE without creating a composite winner score", () => {
    const dataset = makeDataset(2001);
    const legacy = dataset.candidates.map(candidate =>
      legacyBaseline(dataset.observations.filter(o => o.candidateId === candidate.id)),
    );
    const pie = dataset.candidates.map(candidate =>
      pieCandidateBaseline(dataset.observations.filter(o => o.candidateId === candidate.id)),
    );

    expect(legacy).toHaveLength(dataset.candidates.length);
    expect(pie).toHaveLength(dataset.candidates.length);

    const legacyBrier = legacy.reduce((s, e, i) => s + (e.outcomeProbability - dataset.candidates[i].capability) ** 2, 0) / legacy.length;
    const pieBrier = pie.reduce((s, e, i) => s + (e.outcomeProbability - dataset.candidates[i].capability) ** 2, 0) / pie.length;

    expect(Number.isFinite(legacyBrier)).toBe(true);
    expect(Number.isFinite(pieBrier)).toBe(true);
  });

  it("keeps baseline and PIE dimensions separate", () => {
    const dataset = makeDataset(2002);
    const estimate = pieCandidateBaseline(dataset.observations.filter(o => o.candidateId === "C1"));

    expect(estimate.model).toBe("pie_development_baseline");
    expect(estimate.capability).toBeGreaterThanOrEqual(0);
    expect(estimate.capability).toBeLessThanOrEqual(1);
    expect(estimate.timing).toBeGreaterThanOrEqual(0);
    expect(estimate.timing).toBeLessThanOrEqual(1);
    expect(estimate.decision).toBeGreaterThanOrEqual(0);
    expect(estimate.decision).toBeLessThanOrEqual(1);
    expect(estimate.calibration).toBeGreaterThanOrEqual(0);
    expect(estimate.calibration).toBeLessThanOrEqual(1);
  });
});
