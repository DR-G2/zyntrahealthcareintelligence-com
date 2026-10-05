import { describe, expect, it } from "vitest";
import {
  generateInterruptionScenario,
  runInterruptionValidation,
  validateInterruptionScenario,
} from "./interruption";

describe("PIE P2.5 interruption and technical contamination validation", () => {
  it("is deterministic", () => {
    expect(generateInterruptionScenario(101, "TAB_HIDDEN")).toEqual(
      generateInterruptionScenario(101, "TAB_HIDDEN"),
    );
  });

  it("covers browser and technical interruption classes", () => {
    const results = runInterruptionValidation([11, 22]);
    expect(results).toHaveLength(10);
    expect(new Set(results.map(result => result.kind))).toEqual(
      new Set([
        "TAB_HIDDEN",
        "WINDOW_BLURRED",
        "SESSION_PAUSED",
        "PAGE_REFRESHED",
        "NETWORK_OFFLINE",
      ]),
    );
  });

  it("does not encode interruption as a capability change", () => {
    const result = validateInterruptionScenario(
      generateInterruptionScenario(303, "TAB_HIDDEN"),
    );
    expect(result.correctlyIgnoredAsCause).toBe(true);
    expect(result.telemetryContaminationDelta).toBeLessThanOrEqual(0.35);
  });

  it("keeps technical telemetry separate from performance evidence", () => {
    const result = validateInterruptionScenario(
      generateInterruptionScenario(404, "NETWORK_OFFLINE"),
    );
    expect(result.observations).toBe(60);
    expect(Number.isFinite(result.performanceBefore)).toBe(true);
    expect(Number.isFinite(result.performanceAfter)).toBe(true);
  });

  it("does not create a composite contamination score", () => {
    const result = validateInterruptionScenario(
      generateInterruptionScenario(505, "PAGE_REFRESHED"),
    );
    expect(result).not.toHaveProperty("winner");
    expect(result).not.toHaveProperty("score");
  });
});
