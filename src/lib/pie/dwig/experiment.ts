import type { CandidateState } from "../inference/types";
import type { QuestionState } from "../question/types";
import { rankQuestionsForDWIG } from "./scoring";
import { calculateDWIGRegret } from "./regret";

export interface DWIGDecisionExperiment {
  selectedQuestionId: string | null;
  oracleQuestionId: string | null;
  regret: number;
  expectedReduction: number;
  candidateStateUncertainty: number;
}

export function evaluateDWIGSelection(
  candidate: CandidateState,
  questions: QuestionState[],
): DWIGDecisionExperiment {
  const ranked = rankQuestionsForDWIG(candidate, questions);
  const selected = ranked.find(q => q.eligible) ?? null;
  const regret = calculateDWIGRegret(selected, ranked);
  return {
    selectedQuestionId: regret.selectedQuestionId,
    oracleQuestionId: regret.oracleQuestionId,
    regret: regret.regret,
    expectedReduction: selected?.expectedDecisionUncertaintyReduction ?? 0,
    candidateStateUncertainty: candidate.capability.variance,
  };
}
