export type AmcPluginStatus = "DEVELOPMENT" | "VALIDATING" | "CERTIFIED" | "ACTIVE" | "RETIRED" | "REJECTED";
export type AmcReadinessStatus = "NOT_READY_FOR_INFERENCE" | "PRELIMINARY" | "DEVELOPING" | "DECISION_READY" | "INSUFFICIENT_EVIDENCE";
export type AmcPluginVersion = { pluginKey:"AMC_EXAM_INTELLIGENCE"; pluginVersion:string; examCode:"AMC"; contractVersion:string; status:AmcPluginStatus };
export type AmcExamEnvironment = { environmentKey:string; environmentVersion:string; blueprintVersion:string; taskMixVersion:string; timingVersion:string; targetVersion:string; examDurationSeconds?:number };
export type AmcQuestionContext = { questionId:string; pluginVersion:string; environmentKey:string; blueprintDimensionKey?:string; taskKey?:string; systemKey?:string; clinicalDomainKey?:string; questionFamilyKey?:string; cognitiveDemandKey?:string; noveltyClass?:string; relevanceStatus:"UNREVIEWED"|"REVIEWED"|"QUARANTINED"; contentVersion:string };
export type AmcReadinessSnapshot = { targetProbability?:number; lowerBound?:number; upperBound?:number; uncertainty?:number; evidenceSummary:Record<string,unknown>; identificationStatus:string; readinessStatus:AmcReadinessStatus; modelVersion:string };
export type AmcDecisionRequest = { userId:string; environmentKey:string; candidateState:Record<string,unknown>; candidateStateUncertainty:Record<string,unknown>; eligibleQuestions:string[] };
export type AmcDecisionResult = { decisionType:"NEXT_QUESTION"|"NEXT_TASK"|"INTERVENTION"; selectedTask?:Record<string,unknown>; reason:"DWIG"|"INTERVENTION_UTILITY"|"INSUFFICIENT_EVIDENCE" };
