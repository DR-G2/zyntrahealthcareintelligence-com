import { initialCandidateState } from "../inference/types";
import { initialQuestionState } from "../question/model";
import { selectNextQuestion } from "../dwig";
import { orchestrate } from "../runtime";
import type { CandidateState } from "../inference/types";
import type { QuestionState } from "../question/types";
import type { InterventionUtility } from "../intervention/types";

export interface FullSystemValidationResult {
  candidateStatePresent: boolean;
  questionProtectionWorks: boolean;
  dwigSelectsOnlyEligibleQuestion: boolean;
  runtimePreservesUncertainty: boolean;
  runtimeIsNotCandidateFacing: boolean;
  certifiedPromotionRequiresEligibleQuestion: boolean;
  interventionRequiresValidatedEvidence: boolean;
  passed: boolean;
}

function candidateForValidation(): CandidateState {
  const state = initialCandidateState("2026-01-01T00:00:00.000Z");
  const posterior = (estimate: number) => ({
    estimate,
    variance: 0.01,
    lower: Math.max(0, estimate - 0.2),
    upper: Math.min(1, estimate + 0.2),
    confidenceLevel: 0.95,
    evidenceCount: 60,
    evidenceQuality: 0.9,
  });

  return {
    ...state,
    sequence: 12,
    capability: posterior(0.68),
    decision: posterior(0.62),
    timing: posterior(0.58),
    calibration: posterior(0.71),
    sustainedPerformance: posterior(0.55),
    learning: posterior(0.64),
    identificationStatus: "PROVISIONALLY_IDENTIFIED",
    evidenceLevel: "INITIAL_INDIVIDUAL_MODEL",
    dataQuality: 0.95,
  };
}

function questionsForValidation(): QuestionState[] {
  const protectedQuestion = initialQuestionState("Q-PROTECTED", "v1", "PRODUCTION");

  const eligible = initialQuestionState("Q-ELIGIBLE", "v3", "PRODUCTION");
  const candidateIds = Array.from({ length: 12 }, (_, i) => `candidate-${i + 1}`);
  return [
    {
      ...protectedQuestion,
      candidateIdsSeen: candidateIds.slice(0, 2),
      uniqueCandidateCount: 2,
      protected: true,
    },
    {
      ...eligible,
      candidateIdsSeen: candidateIds,
      uniqueCandidateCount: candidateIds.length,
      protected: false,
      evidenceLevel: "OBSERVED_PSYCHOMETRIC",
      difficulty: {
        ...eligible.difficulty,
        variance: 0.03,
        evidenceQuality: 0.9,
        estimate: 0.55,
      },
      discrimination: {
        ...eligible.discrimination,
        variance: 0.03,
        evidenceQuality: 0.9,
        estimate: 0.8,
      },
      ambiguity: {
        ...eligible.ambiguity,
        estimate: 0.1,
        variance: 0.02,
        evidenceQuality: 0.9,
      },
    },
  ];
}

export function runFullSystemValidation(): FullSystemValidationResult {
  const candidate = candidateForValidation();
  const questions = questionsForValidation();

  const protectedSelection = selectNextQuestion(candidate, [questions[0]], "CAPABILITY");
  const normalSelection = selectNextQuestion(candidate, questions, "CAPABILITY");

  const questionProtectionWorks =
    protectedSelection.selectedQuestionId === null &&
    protectedSelection.rankedOptions[0]?.eligible === false &&
    protectedSelection.rankedOptions[0]?.exclusionReason === "QUESTION_PROTECTED";

  const dwigSelectsOnlyEligibleQuestion =
    normalSelection.selectedQuestionId === "Q-ELIGIBLE" &&
    normalSelection.rankedOptions.some(
      option => option.questionId === "Q-PROTECTED" && !option.eligible,
    );

  const runtimeShadow = orchestrate({
    candidate,
    questions,
    context: "CAPABILITY",
    mode: "SHADOW",
  });

  const runtimeCertified = orchestrate({
    candidate,
    questions,
    context: "CAPABILITY",
    mode: "CERTIFIED",
  });

  const runtimePreservesUncertainty =
    Number.isFinite(runtimeShadow.decision.uncertainty) &&
    runtimeShadow.decision.uncertainty >= 0;

  const runtimeIsNotCandidateFacing =
    runtimeShadow.decision.candidateFacing === false &&
    runtimeCertified.decision.candidateFacing === false;

  const certifiedPromotionRequiresEligibleQuestion =
    runtimeCertified.promotionAllowed &&
    runtimeCertified.decision.selectedQuestionId === "Q-ELIGIBLE" &&
    runtimeCertified.decision.selectedQuestionVersion === "v3";

  const intervention: InterventionUtility = {
    interventionId: "i-unvalidated",
    expectedEffect: 0.2,
    probabilityOfCompletion: 0.9,
    expectedCost: 0.01,
    expectedUtility: Number.NEGATIVE_INFINITY,
    uncertainty: 0.5,
    eligible: false,
    exclusionReason: "INSUFFICIENT_VALIDATED_EVIDENCE",
  };

  const runtimeWithUnvalidatedIntervention = orchestrate({
    candidate,
    questions,
    interventionUtilities: [intervention],
    context: "CAPABILITY",
    mode: "CERTIFIED",
  });

  const interventionRequiresValidatedEvidence =
    runtimeWithUnvalidatedIntervention.intervention === null;

  const result = {
    candidateStatePresent: candidate.capability !== undefined &&
      candidate.decision !== undefined &&
      candidate.timing !== undefined &&
      candidate.calibration !== undefined &&
      candidate.sustainedPerformance !== undefined &&
      candidate.learning !== undefined,
    questionProtectionWorks,
    dwigSelectsOnlyEligibleQuestion,
    runtimePreservesUncertainty,
    runtimeIsNotCandidateFacing,
    certifiedPromotionRequiresEligibleQuestion,
    interventionRequiresValidatedEvidence,
  };

  return { ...result, passed: Object.values(result).every(Boolean) };
}
