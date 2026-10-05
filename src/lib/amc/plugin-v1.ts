/**
 * AMC Intelligence Plugin v1.
 *
 * Exam-specific contract only. No PIE weights, readiness formula,
 * latent-state mathematics, or causal intervention claims live here.
 */

export const AMC_PLUGIN_V1 = {
  code: "AMC",
  version: "1.0.0",
  contractVersion: "1.0.0",
  blueprintVersion: "2026.1",
  taxonomyVersion: "1.0.0",
  environmentVersion: "1.0.0",
  targetVersion: "1.0.0",
  modelFamily: "hierarchical_dynamic_state_space",
} as const;

export type AMCExamMode = "MCQ" | "CLINICAL";

export type AMCPatientGroup =
  | "ADULT_MEDICINE"
  | "ADULT_SURGERY"
  | "WOMENS_HEALTH"
  | "CHILD_HEALTH"
  | "MENTAL_HEALTH"
  | "POPULATION_HEALTH";

export type AMCClinicalTask =
  | "HISTORY"
  | "EXAMINATION"
  | "DIAGNOSTIC_FORMULATION"
  | "MANAGEMENT_COUNSELLING_EDUCATION"
  | "COMMUNICATION"
  | "INVESTIGATION_INTERPRETATION";

export interface AMCExamEnvironment {
  code: string;
  version: string;
  mode: AMCExamMode;
  blueprint: Record<string, unknown>;
  timing: Record<string, unknown>;
  taskMix: Record<string, unknown>;
  difficultyDistribution: Record<string, unknown>;
  targetDefinition: Record<string, unknown>;
  durationSeconds: number | null;
}

export interface AMCQuestionContext {
  questionId: string;
  questionVersion: string;
  mode: AMCExamMode;
  patientGroup?: AMCPatientGroup;
  clinicalDomain?: string;
  taskType?: string;
  cognitiveDemand?: string;
  questionFamily?: string;
  noveltyClass?: string;
  amcRelevance?: string;
  sourceEvidenceLevel?: string;
}

export interface AMCCandidateStateInput {
  candidateStateId?: string;
  modelVersion: string;
  dimensions: Record<string, {
    estimate: number;
    variance: number;
    lower: number;
    upper: number;
    evidenceCount: number;
    evidenceQuality: number;
  }>;
  identificationStatus: string;
  evidenceLevel: string;
}

export interface AMCReadinessOutput {
  plugin: "AMC";
  pluginVersion: string;
  environmentCode: string;
  targetProbability: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  uncertaintyMeasure: number | null;
  evidenceCount: number;
  evidenceQuality: number | null;
  identificationStatus: string;
  readinessStatus: "INSUFFICIENT_EVIDENCE" | "ESTIMATE_AVAILABLE" | "DECISION_STABLE";
  modelVersion: string;
}

export interface AMCDWIGContext {
  decisionContext: string;
  questionId?: string;
  taskCode?: string;
  expectedDecisionUncertaintyReduction?: number;
  selectionUncertainty?: number;
  rationale: Record<string, unknown>;
}

export interface AMCInterventionDefinition {
  code: string;
  label: string;
  targetStates: string[];
  eligibleExamModes: AMCExamMode[];
  deliveryType:
    | "QUESTION_SET"
    | "TIMED_BLOCK"
    | "REVIEW"
    | "PERTURBATION"
    | "CLINICAL_TASK"
    | "SIMULATION"
    | "OTHER";
  outcomeDefinition: Record<string, unknown>;
}

export interface AMCCandidateFacingDTO {
  plugin: "AMC";
  pluginVersion: string;
  examMode: AMCExamMode;
  environmentCode: string;
  readiness: {
    probability: number | null;
    uncertainty: number | null;
    status: AMCReadinessOutput["readinessStatus"];
  };
  evidence: {
    count: number;
    quality: number | null;
  };
  nextAction?: {
    type: "QUESTION" | "TASK" | "REVIEW" | "TIMED_BLOCK" | "CLINICAL_TASK";
    reference: string;
  };
}

/**
 * Only this allow-listed DTO may cross the candidate API boundary.
 * Never serialize raw candidate state, question posterior parameters,
 * DWIG candidates, hidden hypotheses, causal estimates, intervention
 * effectiveness, certification state, or another user's data.
 */
export function toCandidateFacingDTO(input: {
  environment: AMCExamEnvironment;
  readiness: AMCReadinessOutput;
  nextAction?: AMCCandidateFacingDTO["nextAction"];
}): AMCCandidateFacingDTO {
  return {
    plugin: "AMC",
    pluginVersion: AMC_PLUGIN_V1.version,
    examMode: input.environment.mode,
    environmentCode: input.environment.code,
    readiness: {
      probability: input.readiness.targetProbability,
      uncertainty: input.readiness.uncertaintyMeasure,
      status: input.readiness.readinessStatus,
    },
    evidence: {
      count: input.readiness.evidenceCount,
      quality: input.readiness.evidenceQuality,
    },
    nextAction: input.nextAction,
  };
}
