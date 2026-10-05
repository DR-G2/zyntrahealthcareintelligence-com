import type { InterventionOutcome } from "./types";

export interface PotentialOutcomePair {
  treated: number;
  untreated: number;
  covariates: Record<string, number>;
}

export interface CausalRecovery {
  averageTreatmentEffect: number;
  trueEffect: number;
  absoluteError: number;
  treatedN: number;
  controlN: number;
  assignmentBias: number;
}

const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;

export function recoverRandomizedEffect(
  treated: PotentialOutcomePair[],
  control: PotentialOutcomePair[],
): CausalRecovery {
  const t=mean(treated.map(x=>x.treated-x.untreated));
  const c=mean(control.map(x=>x.treated-x.untreated));
  const trueEffect=mean([...treated,...control].map(x=>x.treated-x.untreated));
  const observedEffect=t-c;
  return {
    averageTreatmentEffect: observedEffect,
    trueEffect,
    absoluteError: Math.abs(observedEffect-trueEffect),
    treatedN:treated.length,
    controlN:control.length,
    assignmentBias:Math.abs(t-c),
  };
}

export function measurableOutcome(o: InterventionOutcome): boolean {
  const values=[o.immediateValue,o.delayedValue,o.transferValue].filter((v):v is number=>v!==undefined);
  return o.completed && o.outcomeQuality>0 && values.length>0;
}
