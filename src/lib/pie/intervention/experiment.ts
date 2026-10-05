import type { PotentialOutcomePair } from "./causal";

export function seededRandom(seed:number){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296};}

export function makeRandomizedPotentialOutcomes(seed=101,n=120): {
  treated: PotentialOutcomePair[];
  control: PotentialOutcomePair[];
} {
  const r=seededRandom(seed), treated:PotentialOutcomePair[]=[], control:PotentialOutcomePair[]=[];
  for(let i=0;i<n;i++){
    const baseline=.45+.25*r();
    const trueEffect=.08+.08*r();
    const pair={treated:Math.min(1,baseline+trueEffect),untreated:baseline,covariates:{baseline}};
    (r()<.5?treated:control).push(pair);
  }
  return {treated,control};
}
