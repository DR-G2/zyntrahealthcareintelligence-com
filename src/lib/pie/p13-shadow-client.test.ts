import { describe, expect, it } from "vitest";
import { P13_SHADOW_DIMENSIONS, validateP13ShadowPayload } from "./p13-shadow-client";

const dimensions = P13_SHADOW_DIMENSIONS.map((dimension, index) => ({
  dimension,
  estimate: 0.5 + index / 100,
  uncertainty: 0.1,
  lower: 0.3,
  upper: 0.7,
  evidence_count: 12,
  evidence_quality: 0.8,
}));

const payload = (overrides: Record<string, unknown> = {}) => ({
  status: "ready",
  shadow_only: true,
  authoritative: false,
  influences_adaptation: false,
  model_version: "pie-inference-v2.1-shadow",
  source_state_version: 7,
  evidence_maturity: "PRELIMINARY",
  signal_quality: "HIGH",
  inference_hash: "a".repeat(64),
  dimensions,
  ...overrides,
});

describe("PIE P13 shadow read contract", () => {
  it("P13-01 accepts an authenticated candidate's own complete inference", () => {
    expect(validateP13ShadowPayload(payload()).status).toBe("ready");
  });

  it("P13-02 preserves all six certified dimensions", () => {
    expect(validateP13ShadowPayload(payload()).dimensions.map((d) => d.dimension)).toEqual([...P13_SHADOW_DIMENSIONS]);
  });

  it("P13-03 preserves every required numerical field", () => {
    for (const d of validateP13ShadowPayload(payload()).dimensions) {
      expect(d.estimate).toEqual(expect.any(Number));
      expect(d.uncertainty).toEqual(expect.any(Number));
      expect(d.lower).toEqual(expect.any(Number));
      expect(d.upper).toEqual(expect.any(Number));
      expect(d.evidence_count).toEqual(expect.any(Number));
      expect(d.evidence_quality).toEqual(expect.any(Number));
    }
  });

  it("P13-04 preserves uncertainty and interval", () => {
    expect(validateP13ShadowPayload(payload()).dimensions[0]).toMatchObject({ uncertainty: 0.1, lower: 0.3, upper: 0.7 });
  });

  it("P13-05 preserves evidence count and quality", () => {
    expect(validateP13ShadowPayload(payload()).dimensions[0]).toMatchObject({ evidence_count: 12, evidence_quality: 0.8 });
  });

  it("P13-06 preserves model provenance", () => {
    const result = validateP13ShadowPayload(payload({ source_state_version: null, explanation: { shadow_only: true, inference_hash: "abc" } }));
    expect(result.model_version).toBe("pie-inference-v2.1-shadow");
    expect(result.source_state_version).toBeNull();
    expect(result.explanation?.inference_hash).toBe("abc");
  });

  it("P13-07 handles empty inference without fabricating values", () => {
    const result = validateP13ShadowPayload(payload({ status: "no_inference", dimensions: [] }));
    expect(result.status).toBe("incomplete");
    expect(result.dimensions).toEqual([]);
  });

  it("P13-08 preserves null source_state_version", () => {
    expect(validateP13ShadowPayload(payload({ source_state_version: null })).source_state_version).toBeNull();
  });

  it("P13-09 rejects a payload that is not explicitly shadow-only", () => {
    expect(() => validateP13ShadowPayload(payload({ shadow_only: false }))).toThrow("isolation contract");
  });

  it("P13-10 rejects a payload without the shadow security markers", () => {
    expect(() => validateP13ShadowPayload({ dimensions })).toThrow("isolation contract");
  });
});
