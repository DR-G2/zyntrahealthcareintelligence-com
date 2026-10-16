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
  it("does not fabricate uncertainty, interval or per-dimension evidence counts", () => {
    const layer = authoritativePrismLayer(evidence().pie);
    expect(layer.dimensions.every(item => item.uncertainty === null && item.lower === null && item.upper === null && item.evidenceCount === null)).toBe(true);
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
