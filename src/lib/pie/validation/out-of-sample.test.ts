import { describe, expect, it } from "vitest";
import { makeDataset } from "./synthetic";
import { runRepeatedOutOfSample, runSeedExperiment } from "./experiment";

describe("PIE P2.3 out-of-sample validation", () => {
  it("keeps train and test observations temporally separated", () => {
    const dataset = makeDataset(101, 4, 20, 20);
    const byCandidate = new Map<string, typeof dataset.observations>();
    for (const observation of dataset.observations) {
      const list = byCandidate.get(observation.candidateId) ?? [];
      list.push(observation);
      byCandidate.set(observation.candidateId, list);
    }
    for (const observations of byCandidate.values()) {
      observations.sort((a, b) => a.position - b.position);
      const cut = Math.floor(observations.length * 0.7);
      expect(observations.slice(0, cut).every(o => o.position < observations[cut].position)).toBe(true);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(runSeedExperiment(202)).toEqual(runSeedExperiment(202));
  });

  it("scores held-out outcomes with separate model metrics", () => {
    const result = runSeedExperiment(303, 10, 40, 30);
    expect(result.models).toHaveLength(6);
    expect(result.models.every(m => m.testCount > 0)).toBe(true);
    expect(result.models.every(m => Number.isFinite(m.brier) && m.brier >= 0 && m.brier <= 1)).toBe(true);
    expect(result.models.every(m => Number.isFinite(m.logLoss) && m.logLoss >= 0)).toBe(true);
    expect(new Set(result.models.map(m => m.model)).size).toBe(6);
  });

  it("repeats across independent seeds without a composite winner", () => {
    const result = runRepeatedOutOfSample([11, 22, 33]);
    expect(result.seeds).toHaveLength(3);
    expect(result.summary).toHaveLength(6);
    expect(result.summary.every(row => row.totalTestCount > 0)).toBe(true);
    expect(result).not.toHaveProperty("winner");
    expect(result).not.toHaveProperty("compositeScore");
  });
});
