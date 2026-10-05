import { selectNextQuestion } from "../dwig";
import { stateUncertainty } from "../dwig";
import type { InterventionDefinition, InterventionUtility } from "../intervention";
import type { RuntimeInput, RuntimeResult } from "./types";

const id = () =>
  `pie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;

export function orchestrate(input: RuntimeInput): RuntimeResult {
  const dwig = selectNextQuestion(
    input.candidate,
    input.questions,
    input.context,
  );

  const eligibleIntervention =
    input.interventionUtilities
      ?.filter(i => i.eligible)
      .sort((a,b) => b.expectedUtility - a.expectedUtility)[0] ?? null;

  const promotionAllowed =
    input.mode === "CERTIFIED" &&
    dwig.selectedQuestionId !== null &&
    Boolean(dwig.selectedQuestionVersion);

  const interventionId = eligibleIntervention?.interventionId ?? null;

  return {
    decision: {
      decisionId: id(),
      selectedQuestionId: dwig.selectedQuestionId,
      selectedQuestionVersion: dwig.selectedQuestionVersion,
      interventionId,
      context: input.context,
      mode: input.mode,
      candidateStateSequence: input.candidate.sequence,
      modelVersions: {
        candidate: input.candidate.modelVersion,
        dwig: dwig.modelVersion,
        question: input.questions[0]?.modelVersion,
        intervention: eligibleIntervention ? "pie-intervention-dev-0.1" : undefined,
      },
      uncertainty: stateUncertainty(input.candidate),
      rationale: dwig.reason,
      candidateFacing: false,
    },
    dwig,
    intervention: eligibleIntervention,
    promotionAllowed,
  };
}
