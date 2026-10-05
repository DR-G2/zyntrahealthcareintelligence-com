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
  // In a randomized trial, the observed contrast is:
  // mean(Y(1) in treated) - mean(Y(0) in control).
  // Individual potential outcomes are available only because this is a
  // synthetic validation universe.
  const observedEffect =
    mean(treated.map(x=>x.treated)) -
    mean(control.map(x=>x.untreated));
  const trueEffect=mean([...treated,...control].map(x=>x.treated-x.untreated));
  return {
    averageTreatmentEffect: observedEffect,
    trueEffect,
    absoluteError: Math.abs(observedEffect-trueEffect),
    treatedN:treated.length,
    controlN:control.length,
    assignmentBias:Math.abs(observedEffect-trueEffect),
  };
}

export function measurableOutcome(o: InterventionOutcome): boolean {
  const values=[o.immediateValue,o.delayedValue,o.transferValue].filter((v):v is number=>v!==undefined);
  return o.completed && o.outcomeQuality>0 && values.length>0;
}
