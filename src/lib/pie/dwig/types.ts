import type { CandidateState } from "../inference/types";
import type { QuestionState } from "../question/types";

export type DecisionContext =
  | "CAPABILITY"
  | "DECISION"
  | "TIMING"
  | "CALIBRATION"
  | "SUSTAINED_PERFORMANCE"
  | "LEARNING"
  | "EXAM_READINESS";

export interface CandidateQuestionOption {
  questionId: string;
  questionVersion: string;
  state: QuestionState;
  expectedInformationGain: number;
  expectedDecisionUncertaintyReduction: number;
  expectedOutcomeValue: number;
  expectedCost: number;
  completionProbability: number;
  decisionStabilityAfterObservation: number;
  evidenceQuality: number;
  utility: number;
  eligible: boolean;
  exclusionReason?: string;
}

export interface DWIGSelection {
  context: DecisionContext;
  selectedQuestionId: string | null;
  selectedQuestionVersion: string | null;
  rankedOptions: CandidateQuestionOption[];
  decisionUncertaintyBefore: number;
  decisionUncertaintyAfterExpected: number;
  expectedReduction: number;
  selectionUtility: number;
  modelVersion: string;
  reason: string;
}

export interface DWIGConfig {
  modelVersion: string;
  minimumEvidenceQuality: number;
  maximumQuestionUncertainty: number;
  costScale: number;
}

export const DEFAULT_DWIG_CONFIG: DWIGConfig = {
  modelVersion: "pie-dwig-dev-0.1",
  minimumEvidenceQuality: 0.25,
  maximumQuestionUncertainty: 0.65,
  costScale: 1,
};

export function stateUncertainty(state: CandidateState): number {
  const variances = [
    state.capability.variance,
    state.decision.variance,
    state.timing.variance,
    state.calibration.variance,
    state.sustainedPerformance.variance,
    state.learning.variance,
  ];
  return variances.reduce((a, b) => a + b, 0) / variances.length;
}
