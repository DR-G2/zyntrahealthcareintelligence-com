import type { AmcDecisionResult } from "./types";
export function selectAmcDecisionCandidate(args:{dwigAvailable:boolean;interventionUtilityAvailable:boolean}):AmcDecisionResult{
 if(args.dwigAvailable)return{decisionType:"NEXT_QUESTION",reason:"DWIG"};
 if(args.interventionUtilityAvailable)return{decisionType:"INTERVENTION",reason:"INTERVENTION_UTILITY"};
 return{decisionType:"NEXT_TASK",reason:"INSUFFICIENT_EVIDENCE"};
}
