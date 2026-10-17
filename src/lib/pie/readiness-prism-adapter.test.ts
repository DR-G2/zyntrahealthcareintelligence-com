import { describe, expect, it } from "vitest";
import type { IntelligenceEvidence } from "./intelligence-evidence";
import { authoritativePrismLayer, isolatedShadowPrismLayer, observedPrismLayer, prismDimensionsAreComplete } from "./readiness-prism-adapter";

const evidence = (overrides: Partial<IntelligenceEvidence> = {}): IntelligenceEvidence => ({
  pie: { status: "ready", value: {
    dimensions: { capability: 0.8, decision: 0.7, timing: null, calibration: 0.6, sustained_performance: 0.75, learning: 0.5 },
    count: 8, level: "PRELIMINARY", timestamp: "2026-10-16T08:00:00Z", sufficient: true,
  } },
  history: { status: "ready", value: [{ id: "attempt-1", subjectId: "medicine", subject: "Medicine", correct: true, confidence: 4, seconds: 42, changes: 0, at: "2026-10-16T07:00:00Z" }] },
  stability: { status: "empty", value: null },
  confidence: { status: "empty", value: null },
  action: { status: "empty", value: null },
  ...overrides,
});

describe("Readiness Prism presentation adapter", () => {
  it("preserves six dimension identifiers and leaves absent authoritative values null", () => {
    const layer = authoritativePrismLayer(evidence().pie);
    expect(layer.dimensions.map(item => item.dimension)).toEqual(["capability", "decision", "timing", "calibration", "sustained_performance", "learning"]);
    expect(layer.dimensions.find(item => item.dimension === "timing")?.estimate).toBeNull();
    expect(layer.status).toBe("empty");
  });
  it("does not fabricate uncertainty, interval, quality or per-dimension evidence counts", () => {
    const layer = authoritativePrismLayer(evidence().pie);
    expect(layer.dimensions.every(item => item.uncertainty === null && item.lower === null && item.upper === null && item.evidenceCount === null && item.evidenceQuality === null)).toBe(true);
  });
  it("passes through authoritative metadata only when the projection supplies it", () => {
    const input = evidence().pie;
    if (input.status !== "ready" || !input.value) throw new Error("test fixture must be ready");
    input.value.dimensionEvidence = {
      capability: { uncertainty: 0.2, lower: 0.6, upper: 1, evidenceCount: 12, evidenceQuality: 0.9 },
      decision: { uncertainty: 0.3, lower: 0.4, upper: 1, evidenceCount: 9, evidenceQuality: 0.75 },
      timing: { uncertainty: null, lower: null, upper: null, evidenceCount: 0, evidenceQuality: null },
      calibration: { uncertainty: 0.25, lower: 0.35, upper: 0.85, evidenceCount: 8, evidenceQuality: 0.8 },
      sustained_performance: { uncertainty: 0.2, lower: 0.55, upper: 0.95, evidenceCount: 12, evidenceQuality: 0.9 },
      learning: { uncertainty: 0.2, lower: 0.3, upper: 0.7, evidenceCount: 12, evidenceQuality: 0.9 },
    };
    const layer = authoritativePrismLayer(input);
    expect(layer.dimensions.find(item => item.dimension === "capability")).toMatchObject({
      uncertainty: 0.2, lower: 0.6, upper: 1, evidenceCount: 12, evidenceQuality: 0.9,
    });
    expect(layer.dimensions.find(item => item.dimension === "timing")).toMatchObject({
      uncertainty: null, lower: null, upper: null, evidenceCount: 0, evidenceQuality: null,
    });
  });
  it("keeps valid estimates visible while withholding intervals for a misaligned stored estimate", () => {
    const input = evidence().pie;
    if (input.status !== "ready" || !input.value) throw new Error("test fixture must be ready");
    input.value.dimensions.timing = 0.65;
    input.value.dimensionEvidence = {
      capability: { uncertainty: 0.2, lower: 0.6, upper: 1, evidenceCount: 12, evidenceQuality: 0.9, estimateAligned: true },
      decision: { uncertainty: 0.2, lower: 0.5, upper: 0.9, evidenceCount: 12, evidenceQuality: 0.9, estimateAligned: true },
      timing: { uncertainty: null, lower: null, upper: null, evidenceCount: 10, evidenceQuality: 0.8, estimateAligned: false },
      calibration: { uncertainty: 0.3, lower: 0.3, upper: 0.9, evidenceCount: 8, evidenceQuality: 0.8, estimateAligned: true },
      sustained_performance: { uncertainty: 0.2, lower: 0.6, upper: 1, evidenceCount: 12, evidenceQuality: 0.9, estimateAligned: true },
      learning: { uncertainty: 0.2, lower: 0.6, upper: 1, evidenceCount: 12, evidenceQuality: 0.9, estimateAligned: true },
    };
    const layer = authoritativePrismLayer(input);
    expect(layer.status).toBe("ready");
    expect(layer.dimensions.find(item => item.dimension === "timing")).toMatchObject({
      estimate: 0.65, uncertainty: null, lower: null, upper: null, estimateAligned: false,
    });
  });
  it("distinguishes an unavailable authoritative read from empty state", () => {
    expect(authoritativePrismLayer({ status: "unavailable", value: null }).status).toBe("unavailable");
    expect(authoritativePrismLayer({ status: "empty", value: null }).status).toBe("empty");
  });
  it("keeps observed history separate from inferred dimension values", () => {
    const layer = observedPrismLayer(evidence());
    expect(layer.status).toBe("ready");
    expect(layer.evidenceCount).toBe(1);
    expect(layer.dimensions.every(item => item.estimate === null)).toBe(true);
    expect(layer.timestamp).toBe("2026-10-16T07:00:00Z");
  });
  it("keeps the shadow layer explicitly isolated and makes no inference claim", () => {
    const layer = isolatedShadowPrismLayer();
    expect(layer.status).toBe("isolated");
    expect(layer.dimensions.every(item => item.estimate === null)).toBe(true);
    expect(layer.message).toContain("No shadow request was made");
  });
  it("requires six ordered, non-null dimensions before drawing a polygon", () => {
    const layer = authoritativePrismLayer(evidence().pie);
    expect(prismDimensionsAreComplete(layer.dimensions)).toBe(false);
    const complete = layer.dimensions.map(item => ({ ...item, estimate: 0.5 }));
    expect(prismDimensionsAreComplete(complete)).toBe(true);
    expect(prismDimensionsAreComplete([...complete].reverse())).toBe(false);
  });
});