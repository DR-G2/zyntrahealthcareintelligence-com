import { PieObservation, CandidateState } from "../inference/types";
import { QuestionState } from "./types";

export interface JointPrediction {
  probabilityCorrect: number;
  candidateContribution: number;
  questionContribution: number;
  questionUncertainty: number;
  leaveOneQuestionOut: boolean;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function predictCandidateQuestion(
  candidate: CandidateState,
  question: QuestionState,
): JointPrediction {
  const k = candidate.capability.estimate;
  const d = question.difficulty.estimate;
  const discrimination = Math.max(0.25, question.discrimination.estimate * 2);
  const logit = discrimination * (k - d);
  const uncertainty = Math.min(
    1,
    Math.sqrt(candidate.capability.variance + question.difficulty.variance),
  );

  return {
    probabilityCorrect: clamp01(sigmoid(logit)),
    candidateContribution: k,
    questionContribution: d,
    questionUncertainty: uncertainty,
    leaveOneQuestionOut: false,
  };
}

export function predictLeaveOneQuestionOut(
  candidateWithoutQuestion: CandidateState,
  question: QuestionState,
): JointPrediction {
  return {
    ...predictCandidateQuestion(candidateWithoutQuestion, question),
    leaveOneQuestionOut: true,
  };
}

export function observationResidual(
  outcome: 0 | 1,
  predictedProbability: number,
): number {
  return outcome - predictedProbability;
}

export function questionProtectionDecision(
  question: QuestionState,
): "PROTECTED" | "ELIGIBLE_FOR_MODEL_UPDATE" {
  return question.protected ? "PROTECTED" : "ELIGIBLE_FOR_MODEL_UPDATE";
}

export function shouldQuarantineQuestion(question: QuestionState): boolean {
  return (
    question.ambiguity.estimate > 0.7 ||
    question.ambiguity.variance > 0.12 ||
    question.difficulty.evidenceQuality < 0.35
  );
}
