export type PieDimension =
  | "CAPABILITY"
  | "DECISION"
  | "TIMING"
  | "CALIBRATION"
  | "SUSTAINED_PERFORMANCE"
  | "LEARNING";

export type IdentificationStatus =
  | "UNRESOLVED"
  | "PROVISIONALLY_IDENTIFIED"
  | "IDENTIFIED_FOR_DECISION";

export type EvidenceLevel =
  | "INSUFFICIENT"
  | "PRELIMINARY"
  | "DEVELOPING"
  | "INITIAL_INDIVIDUAL_MODEL"
  | "ESTABLISHED_INDIVIDUAL_EVIDENCE"
  | "ROBUST_LONGITUDINAL_PROFILE";

export interface StatePosterior {
  estimate: number;
  variance: number;
  lower: number;
  upper: number;
  confidenceLevel: number;
  evidenceCount: number;
  evidenceQuality: number;
}

export interface CandidateState {
  timestamp: string;
  sequence: number;
  capability: StatePosterior;
  decision: StatePosterior;
  timing: StatePosterior;
  calibration: StatePosterior;
  sustainedPerformance: StatePosterior;
  learning: StatePosterior;
  identificationStatus: IdentificationStatus;
  evidenceLevel: EvidenceLevel;
  dataQuality: number;
  modelVersion: string;
}

export interface PieObservation {
  occurredAt?: string;
  outcome: "CORRECT" | "INCORRECT" | "UNANSWERED" | "INVALID" | "UNKNOWN";
  confidenceNormalized?: number | null;
  timeTotalMs?: number | null;
  timeToFirstInteractionMs?: number | null;
  timeToAnswerMs?: number | null;
  timePostDecisionMs?: number | null;
  firstAnswerCorrect?: boolean | null;
  finalAnswerCorrect?: boolean | null;
  answerChanges?: number | null;
  changeDirection?: "FIRST_TO_FINAL_CORRECT" | "FIRST_TO_FINAL_INCORRECT" | "UNCHANGED" | "UNKNOWN";
  difficulty?: number | null;
  discrimination?: number | null;
  ambiguity?: number | null;
  cognitiveDemand?: number | null;
  novelty?: number | null;
  timePressure?: number | null;
  observationQuality?: "VALID" | "SUSPICIOUS" | "CONTRADICTORY" | "UNUSABLE";
  interruptionActive?: boolean;
  learningContext?: "PRE" | "INTERVENTION" | "IMMEDIATE_TRANSFER" | "DELAYED_TRANSFER" | "NOVEL";
}

export interface InferenceConfig {
  modelVersion: string;
  processVariance: Partial<Record<PieDimension, number>>;
  defaultMeasurementVariance: Partial<Record<PieDimension, number>>;
  intervalZ: number;
  minEvidenceQuality: number;
}

export const DEFAULT_INFERENCE_CONFIG: InferenceConfig = {
  modelVersion: "pie-state-space-dev-0.1",
  processVariance: {
    CAPABILITY: 0.0015,
    DECISION: 0.0025,
    TIMING: 0.0025,
    CALIBRATION: 0.003,
    SUSTAINED_PERFORMANCE: 0.004,
    LEARNING: 0.004,
  },
  defaultMeasurementVariance: {
    CAPABILITY: 0.08,
    DECISION: 0.12,
    TIMING: 0.12,
    CALIBRATION: 0.12,
    SUSTAINED_PERFORMANCE: 0.15,
    LEARNING: 0.18,
  },
  intervalZ: 1.96,
  minEvidenceQuality: 0.25,
};

export function initialPosterior(): StatePosterior {
  return {
    estimate: 0.5,
    variance: 0.25,
    lower: 0,
    upper: 1,
    confidenceLevel: 0.95,
    evidenceCount: 0,
    evidenceQuality: 0,
  };
}

export function initialCandidateState(
  timestamp = new Date(0).toISOString(),
  config = DEFAULT_INFERENCE_CONFIG,
): CandidateState {
  const p = initialPosterior();
  return {
    timestamp,
    sequence: 0,
    capability: { ...p },
    decision: { ...p },
    timing: { ...p },
    calibration: { ...p },
    sustainedPerformance: { ...p },
    learning: { ...p },
    identificationStatus: "UNRESOLVED",
    evidenceLevel: "INSUFFICIENT",
    dataQuality: 0,
    modelVersion: config.modelVersion,
  };
}
