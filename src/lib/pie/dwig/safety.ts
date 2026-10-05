import type { CandidateState } from "../inference/types";
import type { QuestionState } from "../question/types";
import { stateUncertainty } from "./types";

export interface DWIGSafetyResult {
  allowed: boolean;
  reasons: string[];
}

export function validateDWIGSafety(
  candidate: CandidateState,
  question: QuestionState,
): DWIGSafetyResult {
  const reasons: string[] = [];

  if (question.protected) reasons.push("QUESTION_PROTECTED");
  if (question.ambiguity.estimate > 0.7) reasons.push("HIGH_AMBIGUITY");
  if (question.difficulty.variance > 0.12) reasons.push("DIFFICULTY_UNCERTAIN");
  if (question.discrimination.variance > 0.12) reasons.push("DISCRIMINATION_UNCERTAIN");
  if (question.difficulty.evidenceQuality < 0.25) reasons.push("LOW_EVIDENCE_QUALITY");
  if (stateUncertainty(candidate) > 0.24) reasons.push("CANDIDATE_STATE_HIGH_UNCERTAINTY");

  return { allowed: reasons.length === 0, reasons };
}
