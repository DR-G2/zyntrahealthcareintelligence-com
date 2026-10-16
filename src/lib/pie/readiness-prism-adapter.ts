import { DIMENSIONS, type Dimension, type IntelligenceEvidence, type StateEvidence } from "./intelligence-evidence";

export type PrismLayer = "observed" | "authoritative" | "shadow";
export type PrismDimensionValue = {
  dimension: Dimension;
  estimate: number | null;
  uncertainty: number | null;
  lower: number | null;
  upper: number | null;
  evidenceCount: number | null;
  evidenceQuality: number | null;
};
export type PrismLayerModel = {
  layer: PrismLayer;
  status: "ready" | "empty" | "unavailable" | "isolated";
  dimensions: PrismDimensionValue[];
  timestamp: string | null;
  provenance: string;
  evidenceCount: number | null;
  evidenceLevel: string | null;
  message: string | null;
};

const EMPTY_DIMENSIONS = (): PrismDimensionValue[] => DIMENSIONS.map(dimension => ({
  dimension, estimate: null, uncertainty: null, lower: null, upper: null, evidenceCount: null, evidenceQuality: null,
}));

function validFraction(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function validTimestamp(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

export function authoritativePrismLayer(read: IntelligenceEvidence["pie"]): PrismLayerModel {
  if (read.status === "unavailable") return {
    layer: "authoritative", status: "unavailable", dimensions: EMPTY_DIMENSIONS(), timestamp: null,
    provenance: "public.my_pie_state application projection", evidenceCount: null, evidenceLevel: null,
    message: "Authoritative PIE state is temporarily unavailable. No values have been substituted.",
  };
  if (read.status === "empty" || !read.value) return {
    layer: "authoritative", status: "empty", dimensions: EMPTY_DIMENSIONS(), timestamp: null,
    provenance: "public.my_pie_state application projection", evidenceCount: null, evidenceLevel: null,
    message: "No authoritative candidate state is available yet.",
  };
  return statePrismLayer(read.value);
}

function statePrismLayer(state: StateEvidence): PrismLayerModel {
  const dimensions = DIMENSIONS.map(dimension => ({
    dimension,
    estimate: validFraction(state.dimensions[dimension]),
    uncertainty: null,
    lower: null,
    upper: null,
    evidenceCount: null,
    evidenceQuality: null,
  }));
  const complete = dimensions.every(item => item.estimate !== null);
  const sufficient = state.sufficient && complete;
  return {
    layer: "authoritative",
    status: sufficient ? "ready" : "empty",
    dimensions,
    timestamp: validTimestamp(state.timestamp),
    provenance: "public.my_pie_state application projection",
    evidenceCount: Number.isFinite(state.count) && state.count >= 0 ? state.count : null,
    evidenceLevel: typeof state.level === "string" ? state.level : null,
    message: sufficient ? null : "Authoritative dimension values are incomplete or evidence is still building. Missing values remain unavailable.",
  };
}

export function observedPrismLayer(evidence: IntelligenceEvidence): PrismLayerModel {
  if (evidence.history.status === "unavailable") return {
    layer: "observed", status: "unavailable", dimensions: EMPTY_DIMENSIONS(), timestamp: null,
    provenance: "authenticated candidate attempt history", evidenceCount: null, evidenceLevel: null,
    message: "Observed attempt history is temporarily unavailable.",
  };
  const rows = evidence.history.value ?? [];
  const latest = rows.reduce<string | null>((value, row) => {
    const at = validTimestamp(row.at);
    return at && (!value || Date.parse(at) > Date.parse(value)) ? at : value;
  }, null);
  return {
    layer: "observed",
    status: rows.length ? "ready" : "empty",
    dimensions: EMPTY_DIMENSIONS(),
    timestamp: latest,
    provenance: "authenticated candidate attempt history",
    evidenceCount: rows.length,
    evidenceLevel: null,
    message: rows.length ? "Observed attempts are measurements, not inferred dimension scores." : "No observed attempts are available yet.",
  };
}

export function isolatedShadowPrismLayer(): PrismLayerModel {
  return {
    layer: "shadow", status: "isolated", dimensions: EMPTY_DIMENSIONS(), timestamp: null,
    provenance: "P12/P14 shadow diagnostic contract",
    evidenceCount: null, evidenceLevel: null,
    message: "Shadow inference remains isolated from the candidate-facing view until its exposure and server-side authorization are approved. No shadow request was made and no shadow values are displayed.",
  };
}

export function prismDimensionsAreComplete(dimensions: PrismDimensionValue[]): boolean {
  return dimensions.length === DIMENSIONS.length
    && DIMENSIONS.every((name, index) => dimensions[index]?.dimension === name && dimensions[index]?.estimate !== null);
}
