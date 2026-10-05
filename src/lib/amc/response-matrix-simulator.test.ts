import { describe, expect, it } from "vitest";
import {
  allocateBlueprint,
  responseMatrixToCSV,
  simulateAMCResponseMatrix,
} from "./response-matrix-simulator";

describe("AMC response-matrix simulator", () => {
  it("allocates the published blueprint to exactly 150 items", () => {
    const allocation = allocateBlueprint(150);
    expect(Object.values(allocation).reduce((a, b) => a + b, 0)).toBe(150);
    expect(allocation.ADULT_MEDICINE).toBe(45);
    expect(allocation.ADULT_SURGERY).toBe(30);
    expect(
      allocation.WOMENS_HEALTH +
      allocation.CHILD_HEALTH +
      allocation.MENTAL_HEALTH +
      allocation.POPULATION_HEALTH,
    ).toBe(75);
  });

  it("generates 150 responses per candidate and a sparse candidate x pool matrix", () => {
    const result = simulateAMCResponseMatrix({
      seed: 8801,
      candidateCount: 20,
      questionPoolSize: 600,
    });

    expect(result.candidates).toHaveLength(20);
    expect(result.attempts).toHaveLength(20 * 150);

    for (const candidate of result.candidates) {
      expect(result.administeredQuestionIds[candidate.id]).toHaveLength(150);
      const row = result.matrix[candidate.id];
      expect(Object.values(row).filter(v => v !== null)).toHaveLength(150);
    }
  });

  it("keeps at least half of every simulated exam on calibrated items", () => {
    const result = simulateAMCResponseMatrix({
      seed: 8802,
      candidateCount: 20,
      questionPoolSize: 600,
    });

    for (const candidate of result.candidates) {
      const attempts = result.attempts.filter(a => a.candidateId === candidate.id);
      const calibrated = attempts.filter(a => a.itemStatus === "CALIBRATED");
      expect(calibrated.length).toBeGreaterThanOrEqual(75);
    }
  });

  it("is reproducible for the same seed", () => {
    const a = simulateAMCResponseMatrix({
      seed: 8803,
      candidateCount: 3,
      questionPoolSize: 300,
    });
    const b = simulateAMCResponseMatrix({
      seed: 8803,
      candidateCount: 3,
      questionPoolSize: 300,
    });
    expect(a.attempts).toEqual(b.attempts);
    expect(a.matrix).toEqual(b.matrix);
  });

  it("exports the response matrix as CSV", () => {
    const result = simulateAMCResponseMatrix({
      seed: 8804,
      candidateCount: 2,
      questionPoolSize: 200,
    });
    const csv = responseMatrixToCSV(result);
    expect(csv.split("\n")).toHaveLength(3);
    expect(csv.startsWith("candidate_id,AMC-Q-00001")).toBe(true);
  });
});
