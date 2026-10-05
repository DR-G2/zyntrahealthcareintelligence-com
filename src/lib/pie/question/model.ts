import {
  DEFAULT_QUESTION_INFERENCE_CONFIG,
  QuestionInferenceConfig,
  QuestionObservation,
  QuestionPosterior,
  QuestionState,
} from "./types";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function qualityOf(o: QuestionObservation): number {
  switch (o.observationQuality) {
    case "UNUSABLE": return 0;
    case "CONTRADICTORY": return 0.15;
    case "SUSPICIOUS": return 0.5;
    default: return 1;
  }
}

function bayesianUpdate(
  prior: QuestionPosterior,
  signal: number,
  config: QuestionInferenceConfig,
  quality: number,
): QuestionPosterior {
  const predictedVariance = prior.variance + config.processVariance;
  const measurementVariance = config.measurementVariance / Math.max(quality, 0.05);
  const gain = predictedVariance / (predictedVariance + measurementVariance);
  const estimate = clamp01(prior.estimate + gain * (signal - prior.estimate));
  const variance = Math.max(1e-8, (1 - gain) * predictedVariance);
  return {
    estimate,
    variance,
    lower: clamp01(estimate - config.intervalZ * Math.sqrt(variance)),
    upper: clamp01(estimate + config.intervalZ * Math.sqrt(variance)),
    evidenceCount: prior.evidenceCount + 1,
    evidenceQuality: clamp01(
      (prior.evidenceQuality * prior.evidenceCount + quality) / (prior.evidenceCount + 1),
    ),
  };
}

function difficultySignal(o: QuestionObservation): number {
  // Observed difficulty is estimated relative to the candidate capability.
  // This is a local observation, not a final question parameter.
  return clamp01(o.candidateCapabilityEstimate + (o.outcome ? -0.18 : 0.18));
}

function ambiguitySignal(o: QuestionObservation): number {
  if (o.answerChanged) return 0.45;
  return 0.18;
}

function discriminationSignal(o: QuestionObservation): number {
  // A single candidate cannot identify discrimination reliably.
  // This weak signal is retained only as evidence with explicit uncertainty.
  return clamp01(0.5 + (o.outcome ? 0.08 : -0.08));
}

function noveltySignal(o: QuestionObservation): number {
  return clamp01(o.confidence == null ? 0.5 : Math.abs(o.confidence - o.outcome));
}

export function updateQuestionState(
  prior: QuestionState,
  observation: QuestionObservation,
  config: QuestionInferenceConfig = DEFAULT_QUESTION_INFERENCE_CONFIG,
): QuestionState {
  if (
    observation.questionId !== prior.questionId ||
    observation.questionVersion !== prior.questionVersion
  ) {
    throw new Error("question_identity_mismatch");
  }

  const quality = qualityOf(observation);
  const next = {
    ...prior,
    modelVersion: config.modelVersion,
    difficulty: bayesianUpdate(prior.difficulty, difficultySignal(observation), config, quality),
    discrimination: bayesianUpdate(prior.discrimination, discriminationSignal(observation), config, quality * 0.5),
    ambiguity: bayesianUpdate(prior.ambiguity, ambiguitySignal(observation), config, quality),
    novelty: bayesianUpdate(prior.novelty, noveltySignal(observation), config, quality * 0.5),
  };

  const candidateIdsSeen = prior.candidateIdsSeen.includes(observation.candidateId)
    ? prior.candidateIdsSeen
    : [...prior.candidateIdsSeen, observation.candidateId];
  const uniqueCandidateCount = candidateIdsSeen.length;
  const protectedFromCandidateFeedback =
    uniqueCandidateCount < config.minimumCrossCandidateEvidence;

  return {
    ...next,
    uniqueCandidateCount,
    candidateIdsSeen,
    evidenceLevel:
      uniqueCandidateCount < 3
        ? "EXPERT_METADATA"
        : uniqueCandidateCount < 10
          ? "INITIAL_PRODUCTION"
          : uniqueCandidateCount < 30
            ? "OBSERVED_PSYCHOMETRIC"
            : uniqueCandidateCount < 100
              ? "CROSS_CANDIDATE_REPLICATION"
              : "VALIDATED_BEHAVIOUR",
    protected: protectedFromCandidateFeedback,
  };
}

export function initialQuestionState(
  questionId: string,
  questionVersion: string,
  productionStatus = "UNKNOWN",
): QuestionState {
  return {
    questionId,
    questionVersion,
    difficulty: {
      ...initialPosterior(0.5),
      estimate: 0.5,
    },
    discrimination: initialQuestionPosterior(0.5),
    ambiguity: initialQuestionPosterior(0.1),
    novelty: initialQuestionPosterior(0.5),
    evidenceLevel: "EXPERT_METADATA",
    productionStatus,
    modelVersion: DEFAULT_QUESTION_INFERENCE_CONFIG.modelVersion,
    protected: true,
    uniqueCandidateCount: 0,
    candidateIdsSeen: [],
  };
}
