import type { CandidateQuestionOption } from "./types";

export interface DWIGRegret {
  selectedUtility: number;
  oracleUtility: number;
  regret: number;
  selectedQuestionId: string | null;
  oracleQuestionId: string | null;
}

export function calculateDWIGRegret(
  selected: CandidateQuestionOption | null,
  alternatives: CandidateQuestionOption[],
): DWIGRegret {
  const eligible = alternatives.filter(a => a.eligible && Number.isFinite(a.utility));
  const oracle = eligible.length ? eligible.reduce((best, x) => x.utility > best.utility ? x : best) : null;
  const selectedUtility = selected && Number.isFinite(selected.utility) ? selected.utility : 0;
  const oracleUtility = oracle?.utility ?? 0;
  return {
    selectedUtility,
    oracleUtility,
    regret: Math.max(0, oracleUtility - selectedUtility),
    selectedQuestionId: selected?.questionId ?? null,
    oracleQuestionId: oracle?.questionId ?? null,
  };
}
