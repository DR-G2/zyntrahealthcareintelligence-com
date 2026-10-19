import { DIMENSIONS, normalizePracticeMode, type Dimension, type DimensionEvidence, type IntelligenceEvidence, type PracticeMode, type StateEvidence } from "./intelligence-evidence";

export type PrismLayer = "observed" | "authoritative" | "shadow";
export type PrismDimensionValue = {
  dimension: Dimension;
  estimate: number | null;
  uncertainty: number | null;
  lower: number | null;
  upper: number | null;
  evidenceCount: number | null;
  evidenceQuality: number | null;
  estimateAligned?: boolean | null;
  calibrationReady?: boolean | null;
  confidenceLevelCounts?: Record<string, number | null> | null;
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

export const MIN_DIMENSION_OBSERVATIONS = 50;

const EMPTY_DIMENSIONS = (): PrismDimensionValue[] => DIMENSIONS.map(dimension => ({
  dimension, estimate: null, uncertainty: null, lower: null, upper: null, evidenceCount: null, evidenceQuality: null, estimateAligned: null, calibrationReady: null, confidenceLevelCounts: null,
}));

function validFraction(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function validCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function validTimestamp(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

export function authoritativePrismLayer(read: IntelligenceEvidence["pie"], selectedMode: PracticeMode | null = null): PrismLayerModel {
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
  return statePrismLayer(read.value, selectedMode);
}

function statePrismLayer(state: StateEvidence, selectedMode: PracticeMode | null): PrismLayerModel {
  const selectedModeEvidence = selectedMode ? state.modeEvidence?.[selectedMode] : undefined;
  // Legacy data is usable only when the authoritative row explicitly declares the exact mode.
  const legacyModeScope = selectedMode !== null && normalizePracticeMode(state.sessionMode) === selectedMode;
  const modeScoped = selectedMode !== null && (selectedModeEvidence !== undefined || legacyModeScope);
  const dimensions = DIMENSIONS.map(dimension => {
    const metadata: DimensionEvidence | undefined = selectedModeEvidence?.[dimension]
      ?? (legacyModeScope ? state.dimensionEvidence?.[dimension] : undefined);
    const evidenceCount = modeScoped ? validCount(metadata?.evidenceCount) : null;
    const evidenceQuality = validFraction(metadata?.evidenceQuality);
    const sourceEstimate = selectedModeEvidence
      ? validFraction(selectedModeEvidence[dimension]?.estimate)
      : legacyModeScope ? validFraction(state.dimensions[dimension]) : null;
    const calibrationReady = dimension !== "calibration" || metadata?.calibrationReady === true;
    const eligible = evidenceCount !== null
      && evidenceCount >= MIN_DIMENSION_OBSERVATIONS
      && evidenceQuality !== null
      && evidenceQuality > 0
      && metadata?.estimateAligned === true
      && sourceEstimate !== null
      && calibrationReady
      && modeScoped;
    const uncertainty = eligible ? validFraction(metadata?.uncertainty) : null;
    const rawLower = eligible ? validFraction(metadata?.lower) : null;
    const rawUpper = eligible ? validFraction(metadata?.upper) : null;
    const intervalValid = sourceEstimate !== null && rawLower !== null && rawUpper !== null
      && rawLower <= rawUpper && rawLower <= sourceEstimate && sourceEstimate <= rawUpper;
    return {
      dimension,
      estimate: eligible ? sourceEstimate : null,
      uncertainty,
      lower: intervalValid ? rawLower : null,
      upper: intervalValid ? rawUpper : null,
      evidenceCount,
      evidenceQuality: eligible ? evidenceQuality : null,
      estimateAligned: typeof metadata?.estimateAligned === "boolean" ? metadata.estimateAligned : null,
      calibrationReady: metadata?.calibrationReady ?? null,
      confidenceLevelCounts: metadata?.confidenceLevelCounts ?? null,
    };
  });
  const complete = dimensions.every(item => item.estimate !== null);
  const metadataComplete = dimensions.every(item => item.evidenceCount !== null
    && (item.evidenceCount === 0 || item.evidenceQuality !== null)
    && ((item.uncertainty === null && item.lower === null && item.upper === null)
      || (item.uncertainty !== null && item.lower !== null && item.upper !== null)));
  const sufficient = modeScoped && complete && metadataComplete
    && dimensions.every(item => item.evidenceCount !== null
      && item.evidenceCount >= MIN_DIMENSION_OBSERVATIONS
      && item.evidenceQuality !== null && item.evidenceQuality > 0
      && item.estimateAligned === true
      && (item.dimension !== "calibration" || item.calibrationReady === true));
  const calibration = dimensions.find(item => item.dimension === "calibration");
  return {
    layer: "authoritative",
    status: sufficient ? "ready" : "empty",
    dimensions,
    timestamp: validTimestamp(state.timestamp),
    provenance: "public.my_pie_state application projection",
    evidenceCount: Number.isFinite(state.count) && state.count >= 0 ? state.count : null,
    evidenceLevel: typeof state.level === "string" ? state.level : null,
    message: sufficient ? null : !modeScoped
      ? "Mode-specific PIE evidence is unavailable for this practice mode. No cross-mode estimate is shown."
      : calibration?.evidenceCount !== null && (calibration?.evidenceCount ?? 0) >= MIN_DIMENSION_OBSERVATIONS && calibration?.calibrationReady !== true
        ? "Calibration remains unavailable until at least 15 valid scored answers exist at each confidence level (1–5) in this mode."
        : "Building evidence: each dimension needs at least 50 valid observations. Missing dimension counts remain unavailable.",
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