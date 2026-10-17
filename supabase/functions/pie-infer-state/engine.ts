import { DEFAULT_INFERENCE_CONFIG, initialCandidateState } from "./types.ts";
import type { CandidateState, InferenceConfig, PieObservation, StatePosterior } from "./types.ts";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function logit(p: number): number {
  const x = clamp01(p);
  return Math.log(x / (1 - x));
}

function qualityOf(o: PieObservation): number {
  if (o.observationQuality === "UNUSABLE") return 0;
  if (o.observationQuality === "CONTRADICTORY") return 0.15;
  if (o.observationQuality === "SUSPICIOUS") return 0.5;
  return o.interruptionActive ? 0.25 : 1;
}

function normaliseTiming(o: PieObservation): number | null {
  if (o.timeTotalMs == null || o.timeTotalMs <= 0) return null;
  if (o.timePressure != null) return clamp01(1 - o.timePressure);
  return clamp01(1 / (1 + Math.log1p(o.timeTotalMs / 1000) / 10));
}

function decisionSignal(o: PieObservation): number | null {
  if (o.firstAnswerCorrect == null || o.finalAnswerCorrect == null) return null;
  if (o.firstAnswerCorrect === o.finalAnswerCorrect) return 0.5;
  return o.finalAnswerCorrect ? 0.75 : 0.25;
}

function calibrationSignal(o: PieObservation): number | null {
  if (o.confidenceNormalized == null || o.outcome === "UNANSWERED" || o.outcome === "INVALID") return null;
  const y = o.outcome === "CORRECT" ? 1 : 0;
  const error = Math.abs(o.confidenceNormalized - y);
  return clamp01(1 - error);
}

function capabilitySignal(o: PieObservation, prior: StatePosterior): number | null {
  if (o.outcome !== "CORRECT" && o.outcome !== "INCORRECT") return null;
  const difficulty = o.difficulty ?? 0.5;
  const discrimination = Math.max(0.25, o.discrimination ?? 1);
  const y = o.outcome === "CORRECT" ? 1 : 0;
  const targetLogit = logit(clamp01(prior.estimate));
  const observationLogit = targetLogit + (y - sigmoid(discrimination * (prior.estimate - difficulty))) / discrimination;
  return clamp01(sigmoid(observationLogit));
}

function sustainedSignal(o: PieObservation): number | null {
  if (o.outcome !== "CORRECT" && o.outcome !== "INCORRECT") return null;
  const y = o.outcome === "CORRECT" ? 1 : 0;
  return y;
}

function learningSignal(o: PieObservation): number | null {
  if (!o.learningContext) return null;
  if (o.outcome !== "CORRECT" && o.outcome !== "INCORRECT") return null;
  return o.outcome === "CORRECT" ? 1 : 0;
}

function updateScalar(
  prior: StatePosterior,
  signal: number | null,
  measurementVariance: number,
  processVariance: number,
  quality: number,
): StatePosterior {
  if (signal == null || quality <= 0) {
    return {
      ...prior,
      variance: prior.variance + processVariance,
      lower: clamp01(prior.estimate - 1.96 * Math.sqrt(prior.variance + processVariance)),
      upper: clamp01(prior.estimate + 1.96 * Math.sqrt(prior.variance + processVariance)),
    };
  }

  const predictedVariance = prior.variance + processVariance;
  const effectiveMeasurementVariance = measurementVariance / Math.max(quality, 0.05);
  const gain = predictedVariance / (predictedVariance + effectiveMeasurementVariance);
  const estimate = clamp01(prior.estimate + gain * (signal - prior.estimate));
  const variance = Math.max(1e-8, (1 - gain) * predictedVariance);
  const lower = clamp01(estimate - 1.96 * Math.sqrt(variance));
  const upper = clamp01(estimate + 1.96 * Math.sqrt(variance));

  return {
    estimate,
    variance,
    lower,
    upper,
    confidenceLevel: 0.95,
    evidenceCount: prior.evidenceCount + 1,
    evidenceQuality: clamp01((prior.evidenceQuality * prior.evidenceCount + quality) / (prior.evidenceCount + 1)),
  };
}

function evidenceLevel(totalEvidence: number): CandidateState["evidenceLevel"] {
  if (totalEvidence < 6) return "INSUFFICIENT";
  if (totalEvidence < 20) return "PRELIMINARY";
  if (totalEvidence < 40) return "DEVELOPING";
  if (totalEvidence < 60) return "INITIAL_INDIVIDUAL_MODEL";
  if (totalEvidence < 100) return "ESTABLISHED_INDIVIDUAL_EVIDENCE";
  return "ROBUST_LONGITUDINAL_PROFILE";
}

function identify(state: CandidateState): CandidateState["identificationStatus"] {
  const posteriors = [
    state.capability,
    state.decision,
    state.timing,
    state.calibration,
    state.sustainedPerformance,
    state.learning,
  ];
  const supported = posteriors.filter(p => p.evidenceCount >= 6 && p.evidenceQuality >= 0.5);
  const narrow = supported.filter(p => p.variance < 0.08);
  if (narrow.length >= 4) return "IDENTIFIED_FOR_DECISION";
  if (supported.length >= 2) return "PROVISIONALLY_IDENTIFIED";
  return "UNRESOLVED";
}

export function updateCandidateState(
  prior: CandidateState | undefined,
  observation: PieObservation,
  config: InferenceConfig = DEFAULT_INFERENCE_CONFIG,
): CandidateState {
  const base = prior ?? initialCandidateState(observation.occurredAt, config);
  const quality = qualityOf(observation);

  const next = {
    ...base,
    timestamp: observation.occurredAt ?? new Date().toISOString(),
    sequence: base.sequence + 1,
    capability: updateScalar(
      base.capability,
      capabilitySignal(observation, base.capability),
      config.defaultMeasurementVariance.CAPABILITY ?? 0.08,
      config.processVariance.CAPABILITY ?? 0.0015,
      quality,
    ),
    decision: updateScalar(
      base.decision,
      decisionSignal(observation),
      config.defaultMeasurementVariance.DECISION ?? 0.12,
      config.processVariance.DECISION ?? 0.0025,
      quality,
    ),
    timing: updateScalar(
      base.timing,
      normaliseTiming(observation),
      config.defaultMeasurementVariance.TIMING ?? 0.12,
      config.processVariance.TIMING ?? 0.0025,
      quality,
    ),
    calibration: updateScalar(
      base.calibration,
      calibrationSignal(observation),
      config.defaultMeasurementVariance.CALIBRATION ?? 0.12,
      config.processVariance.CALIBRATION ?? 0.003,
      quality,
    ),
    sustainedPerformance: updateScalar(
      base.sustainedPerformance,
      sustainedSignal(observation),
      config.defaultMeasurementVariance.SUSTAINED_PERFORMANCE ?? 0.15,
      config.processVariance.SUSTAINED_PERFORMANCE ?? 0.004,
      quality * (observation.interruptionActive ? 0.25 : 1),
    ),
    learning: updateScalar(
      base.learning,
      learningSignal(observation),
      config.defaultMeasurementVariance.LEARNING ?? 0.18,
      config.processVariance.LEARNING ?? 0.004,
      quality,
    ),
    dataQuality: clamp01(
      (base.dataQuality * base.sequence + quality) / (base.sequence + 1),
    ),
  } satisfies CandidateState;

  const totalEvidence = [
    next.capability,
    next.decision,
    next.timing,
    next.calibration,
    next.sustainedPerformance,
    next.learning,
  ].reduce((sum, p) => sum + p.evidenceCount, 0);

  return {
    ...next,
    evidenceLevel: evidenceLevel(totalEvidence / 6),
    identificationStatus: identify(next),
  };
}

export function updateCandidateStateSequence(
  observations: PieObservation[],
  config: InferenceConfig = DEFAULT_INFERENCE_CONFIG,
): CandidateState[] {
  let state: CandidateState | undefined;
  return observations.map(o => {
    state = updateCandidateState(state, o, config);
    return state;
  });
}
