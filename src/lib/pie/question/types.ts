export type QuestionParameter = "DIFFICULTY" | "DISCRIMINATION" | "AMBIGUITY" | "NOVELTY";

export type QuestionEvidenceLevel =
  | "EXPERT_METADATA"
  | "INITIAL_PRODUCTION"
  | "OBSERVED_PSYCHOMETRIC"
  | "CROSS_CANDIDATE_REPLICATION"
  | "VALIDATED_BEHAVIOUR"
  | "STABLE_PRODUCTION";

export type QuestionEvidenceQuality = "VALID" | "SUSPICIOUS" | "CONTRADICTORY" | "UNUSABLE";

export interface QuestionPosterior {
  estimate: number;
  variance: number;
  lower: number;
  upper: number;
  evidenceCount: number;
  evidenceQuality: number;
}

export interface QuestionState {
  questionId: string;
  questionVersion: string;
  difficulty: QuestionPosterior;
  discrimination: QuestionPosterior;
  ambiguity: QuestionPosterior;
  novelty: QuestionPosterior;
  evidenceLevel: QuestionEvidenceLevel;
  productionStatus: string;
  modelVersion: string;
  protected: boolean;
  uniqueCandidateCount: number;
}

export interface QuestionObservation {
  candidateId: string;
  questionId: string;
  questionVersion: string;
  outcome: 0 | 1;
  candidateCapabilityEstimate: number;
  candidateCapabilityVariance: number;
  answerChanged: boolean;
  firstAnswerCorrect?: boolean;
  finalAnswerCorrect?: boolean;
  confidence?: number | null;
  observationQuality?: QuestionEvidenceQuality;
  sourceObservationId?: string;
}

export interface QuestionInferenceConfig {
  modelVersion: string;
  priorVariance: number;
  processVariance: number;
  measurementVariance: number;
  intervalZ: number;
  minimumCandidateEvidence: number;
  minimumCrossCandidateEvidence: number;
}

export const DEFAULT_QUESTION_INFERENCE_CONFIG: QuestionInferenceConfig = {
  modelVersion: "pie-question-dev-0.1",
  priorVariance: 0.16,
  processVariance: 0.001,
  measurementVariance: 0.10,
  intervalZ: 1.96,
  minimumCandidateEvidence: 3,
  minimumCrossCandidateEvidence: 10,
};

export function initialQuestionPosterior(estimate = 0.5): QuestionPosterior {
  return {
    estimate,
    variance: DEFAULT_QUESTION_INFERENCE_CONFIG.priorVariance,
    lower: Math.max(0, estimate - 1.96 * Math.sqrt(DEFAULT_QUESTION_INFERENCE_CONFIG.priorVariance)),
    upper: Math.min(1, estimate + 1.96 * Math.sqrt(DEFAULT_QUESTION_INFERENCE_CONFIG.priorVariance)),
    evidenceCount: 0,
    evidenceQuality: 0,
  };
}
