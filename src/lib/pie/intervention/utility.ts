import type { CandidateState } from "../inference/types";
import type { InterventionDefinition, InterventionEffectEstimate, InterventionUtility } from "./types";

export function rankInterventions(
  candidate: CandidateState,
  interventions: InterventionDefinition[],
  effects: Map<string, InterventionEffectEstimate>,
): InterventionUtility[] {
  const uncertainty = (
    candidate.capability.variance +
    candidate.decision.variance +
    candidate.timing.variance +
    candidate.calibration.variance +
    candidate.sustainedPerformance.variance +
    candidate.learning.variance
  ) / 6;

  return interventions.map(i => {
    const effect = effects.get(i.id);
    const evidence = effect?.evidenceQuality ?? 0;
    const expectedEffect = effect?.effectEstimate ?? 0;
    const expectedUtility =
      effect && effect.causalStatus !== "NOT_CAUSAL"
        ? expectedEffect * i.completionProbability - i.estimatedCost
        : expectedEffect * i.completionProbability * evidence - i.estimatedCost;

    const eligible = i.productionStatus === "ACTIVE" && evidence >= 0.25;

    return {
      interventionId: i.id,
      expectedEffect,
      probabilityOfCompletion: i.completionProbability,
      expectedCost: i.estimatedCost,
      expectedUtility: eligible ? expectedUtility : Number.NEGATIVE_INFINITY,
      uncertainty,
      eligible,
      exclusionReason: eligible ? undefined : "INSUFFICIENT_VALIDATED_EVIDENCE",
    };
  }).sort((a,b)=>b.expectedUtility-a.expectedUtility);
}
