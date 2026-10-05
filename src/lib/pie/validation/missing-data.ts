import { seededRng } from "./synthetic";

export type MissingnessMechanism = "MCAR" | "MAR" | "MNAR";
export type EvidenceStatus = "INSUFFICIENT" | "PRELIMINARY" | "SUPPORTED";

export type MissingObservation = {
  index: number;
  trueCapability: number;
  outcome: number | null;
  missing: boolean;
};

export type MissingDataResult = {
  mechanism: MissingnessMechanism;
  missingRate: number;
  stateEstimate: number;
  stateUncertainty: number;
  evidenceStatus: EvidenceStatus;
  falseCertainty: boolean;
  stateError: number;
};

function mean(values:number[]):number {
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
}

function variance(values:number[]):number {
  if(values.length<2) return 1;
  const m=mean(values);
  return mean(values.map(v=>(v-m)**2));
}

export function generateMissingScenario(
  seed:number,
  mechanism:MissingnessMechanism,
  length=100,
):MissingObservation[] {
  const rng=seededRng(seed);
  return Array.from({length},(_,index)=>{
    const capability=0.70;
    const probability=0.70;
    const outcome=rng()<probability?1:0;
    let missingProbability=0.15;
    if(mechanism==="MAR") missingProbability=index%5===0?0.45:0.08;
    if(mechanism==="MNAR") missingProbability=outcome===0?0.55:0.04;
    const missing=rng()<missingProbability;
    return {
      index,
      trueCapability:capability,
      outcome:missing?null:outcome,
      missing,
    };
  });
}

export function estimateWithUncertainty(
  observations:MissingObservation[],
):{
  stateEstimate:number;
  stateUncertainty:number;
  evidenceStatus:EvidenceStatus;
  falseCertainty:boolean;
  stateError:number;
} {
  const observed=observations.filter(o=>o.outcome!==null).map(o=>o.outcome as number);
  const estimate=mean(observed);
  const uncertainty=Math.min(1,Math.sqrt(variance(observed)/Math.max(1,observed.length)));
  const evidenceStatus=
    observed.length<20 ? "INSUFFICIENT" :
    observed.length<50 ? "PRELIMINARY" : "SUPPORTED";

  const falseCertainty=
    observed.length<20 && uncertainty<0.12;

  return {
    stateEstimate:estimate,
    stateUncertainty:uncertainty,
    evidenceStatus,
    falseCertainty,
    stateError:Math.abs(estimate-0.70),
  };
}

export function validateMissingData(
  seed:number,
  mechanism:MissingnessMechanism,
):MissingDataResult {
  const observations=generateMissingScenario(seed,mechanism);
  const estimate=estimateWithUncertainty(observations);
  return {
    mechanism,
    missingRate:observations.filter(o=>o.missing).length/observations.length,
    ...estimate,
  };
}

export function runMissingDataValidation(
  seeds:number[]|number=[101,202,303,404,505],
):MissingDataResult[] {
  const normalizedSeeds=Array.isArray(seeds)?seeds:[seeds];
  const mechanisms:MissingnessMechanism[]=["MCAR","MAR","MNAR"];
  return normalizedSeeds.flatMap(seed=>mechanisms.map(m=>validateMissingData(seed,m)));
}
