import type { CandidateState } from "../inference/types";
import type { QuestionState } from "../question/types";
import type { DWIGSelection, DecisionContext } from "../dwig/types";
import type { InterventionDefinition, InterventionUtility } from "../intervention/types";

export type PieRuntimeMode = "SHADOW" | "DEVELOPMENT" | "VALIDATING" | "CERTIFIED";

export interface RuntimeInput {
  candidate: CandidateState;
  questions: QuestionState[];
  interventions?: InterventionDefinition[];
  interventionUtilities?: InterventionUtility[];
  context: DecisionContext;
  mode: PieRuntimeMode;
  examAdapterVersion?: string;
}

export interface RuntimeDecision {
  decisionId: string;
  selectedQuestionId: string | null;
  selectedQuestionVersion: string | null;
  interventionId: string | null;
  context: DecisionContext;
  mode: PieRuntimeMode;
  candidateStateSequence: number;
  modelVersions: {
    candidate: string;
    question?: string;
    dwig: string;
    intervention?: string;
  };
  uncertainty: number;
  rationale: string;
  candidateFacing: boolean;
}

export interface RuntimeResult {
  decision: RuntimeDecision;
  dwig: DWIGSelection;
  intervention: InterventionUtility | null;
  promotionAllowed: boolean;
}
