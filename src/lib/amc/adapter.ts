import type { AmcExamEnvironment, AmcReadinessSnapshot } from "./types";
export type PieCandidateState={capability?:unknown;decision?:unknown;timing?:unknown;calibration?:unknown;sustainedPerformance?:unknown;learning?:unknown};
export type PieStateInput={state:PieCandidateState;uncertainty:Record<string,unknown>;modelVersion:string};
export type AmcAdapterInput=PieStateInput&{environment:AmcExamEnvironment};
export function buildAmcReadinessAdapterInput(input:AmcAdapterInput):Record<string,unknown>{return{candidateState:input.state,candidateStateUncertainty:input.uncertainty,modelVersion:input.modelVersion,examEnvironment:input.environment,readinessIsDerivedOutput:true};}
export function emptyAmcReadiness(modelVersion:string):AmcReadinessSnapshot{return{evidenceSummary:{status:"no_validated_amc_inference",reason:"AMC_PLUGIN_V1_DEVELOPMENT"},identificationStatus:"UNRESOLVED",readinessStatus:"NOT_READY_FOR_INFERENCE",modelVersion};}
