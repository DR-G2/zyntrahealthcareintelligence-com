export type InterventionOutcomeType =
  | "IMMEDIATE_PERFORMANCE"
  | "NOVEL_TRANSFER"
  | "DELAYED_TRANSFER"
  | "TIMING"
  | "CALIBRATION"
  | "RECOVERY"
  | "DECISION";

export interface InterventionDefinition {
  id: string;
  name: string;
  targetDimension: string;
  intendedMechanism: string;
  estimatedCost: number;
  completionProbability: number;
  outcomeType: InterventionOutcomeType;
  productionStatus: "DEVELOPMENT" | "VALIDATING" | "ACTIVE" | "RETIRED";
}

export interface InterventionContext {
  userId: string;
  interventionId: string;
  baselineStateId?: string;
  startedAt: string;
  context: Record<string, unknown>;
}

export interface InterventionOutcome {
  interventionId: string;
  userId: string;
  outcomeType: InterventionOutcomeType;
  baselineValue: number;
  immediateValue?: number;
  delayedValue?: number;
  transferValue?: number;
  completed: boolean;
  outcomeQuality: number;
  measuredAt: string;
  sourceObservationIds: string[];
}

export interface InterventionEffectEstimate {
  modelVersion: string;
  interventionId: string;
  targetDimension: string;
  treatmentMean: number;
  comparisonMean: number;
  effectEstimate: number;
  uncertainty: number;
  sampleSize: number;
  evidenceQuality: number;
  confoundingRisk: number;
  design: "DESCRIPTIVE" | "QUASI_EXPERIMENTAL" | "RANDOMIZED";
  causalStatus: "NOT_CAUSAL" | "PRELIMINARY_CAUSAL" | "CAUSAL";
}

export interface InterventionUtility {
  interventionId: string;
  expectedEffect: number;
  probabilityOfCompletion: number;
  expectedCost: number;
  expectedUtility: number;
  uncertainty: number;
  eligible: boolean;
  exclusionReason?: string;
}
