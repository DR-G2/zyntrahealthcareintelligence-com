import type { CandidateState } from "../inference/types";
import type { QuestionState } from "../question/types";
import {
  CandidateQuestionOption,
  DEFAULT_DWIG_CONFIG,
  DWIGConfig,
  stateUncertainty,
} from "./types";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function questionUncertainty(q: QuestionState): number {
  return Math.min(
    1,
    Math.sqrt(
      (q.difficulty.variance +
        q.discrimination.variance +
        q.ambiguity.variance +
        q.novelty.variance) / 4,
    ),
  );
}

function decisionTargetUncertainty(candidate: CandidateState): number {
  const u = stateUncertainty(candidate);
  return u;
}

function expectedReductionForQuestion(
  candidate: CandidateState,
  question: QuestionState,
): number {
  const candidateU = decisionTargetUncertainty(candidate);
  const qU = questionUncertainty(question);
  const candidateVariance = Math.max(1e-8, candidate.capability.variance);
  const questionVariance = Math.max(1e-8, question.difficulty.variance);
  const measurementNoise = Math.max(0.01, qU * qU);
  const discrimination = Math.max(0.05, question.discrimination.estimate);
  const sensitivity = discrimination * discrimination;
  const posteriorVariance =
    candidateVariance -
    (candidateVariance * sensitivity * candidateVariance) /
      Math.max(1e-8, sensitivity * candidateVariance + measurementNoise + questionVariance);
  return clamp01(Math.max(0, candidateVariance - posteriorVariance));
}

function completionProbability(question: QuestionState): number {
  const ambiguityPenalty = Math.max(0, question.ambiguity.estimate - 0.5);
  return clamp01(0.95 - ambiguityPenalty * 0.6);
}

function expectedOutcomeValue(
  candidate: CandidateState,
  question: QuestionState,
): number {
  const p = clamp01(
    1 /
      (1 +
        Math.exp(
          -Math.max(0.25, question.discrimination.estimate * 2) *
            (candidate.capability.estimate - question.difficulty.estimate),
        )),
  );
  return Math.abs(0.5 - p) * 2;
}

function eligibility(
  question: QuestionState,
  config: DWIGConfig,
): { eligible: boolean; reason?: string; qU: number } {
  const qU = questionUncertainty(question);
  if (question.protected) return { eligible: false, reason: "QUESTION_PROTECTED", qU };
  if (qU > config.maximumQuestionUncertainty) return { eligible: false, reason: "QUESTION_UNCERTAIN", qU };
  if (question.productionStatus && question.productionStatus !== "PRODUCTION") {
    return { eligible: false, reason: "NOT_PRODUCTION", qU };
  }
  return { eligible: true, qU };
}

export function rankQuestionsForDWIG(
  candidate: CandidateState,
  questions: QuestionState[],
  config: DWIGConfig = DEFAULT_DWIG_CONFIG,
): CandidateQuestionOption[] {
  return questions.map((question) => {
    const gate = eligibility(question, config);
    const expectedInformationGain = expectedReductionForQuestion(candidate, question);
    const completion = completionProbability(question);
    const outcomeValue = expectedOutcomeValue(candidate, question);
    const evidenceQuality = Math.max(
      question.difficulty.evidenceQuality,
      question.discrimination.evidenceQuality,
    );
    const cost = config.costScale * (1 + question.ambiguity.estimate);
    const utility =
      gate.eligible && evidenceQuality >= config.minimumEvidenceQuality
        ? expectedInformationGain * completion * (1 + outcomeValue) - cost * 0.01
        : Number.NEGATIVE_INFINITY;

    return {
      questionId: question.questionId,
      questionVersion: question.questionVersion,
      state: question,
      expectedInformationGain,
      expectedDecisionUncertaintyReduction: expectedInformationGain,
      expectedOutcomeValue: outcomeValue,
      expectedCost: cost,
      completionProbability: completion,
      decisionStabilityAfterObservation: clamp01(1 - expectedInformationGain),
      evidenceQuality,
      utility,
      eligible: gate.eligible && evidenceQuality >= config.minimumEvidenceQuality,
      exclusionReason: gate.reason,
    };
  }).sort((a, b) => b.utility - a.utility);
}

export function selectNextQuestion(
  candidate: CandidateState,
  questions: QuestionState[],
  context: DecisionContext,
  config: DWIGConfig = DEFAULT_DWIG_CONFIG,
): DWIGSelection {
  const rankedOptions = rankQuestionsForDWIG(candidate, questions, config);
  const selected = rankedOptions.find(q => q.eligible) ?? null;
  const before = stateUncertainty(candidate);
  const after = selected
    ? Math.max(0, before - selected.expectedDecisionUncertaintyReduction)
    : before;

  return {
    context,
    selectedQuestionId: selected?.questionId ?? null,
    selectedQuestionVersion: selected?.questionVersion ?? null,
    rankedOptions,
    decisionUncertaintyBefore: before,
    decisionUncertaintyAfterExpected: after,
    expectedReduction: before - after,
    selectionUtility: selected?.utility ?? 0,
    modelVersion: config.modelVersion,
    reason: selected
      ? "Selected by expected decision-uncertainty reduction under current evidence."
      : "No eligible question has sufficient evidence and uncertainty quality.",
  };
}
