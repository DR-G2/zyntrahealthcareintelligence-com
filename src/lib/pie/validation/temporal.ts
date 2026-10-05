import { clamp01, seededRng, normal, sigmoid } from "./synthetic";
import { mean, rmse } from "./metrics";

export type TrajectoryKind = "stable" | "gradual_decline" | "sudden_change" | "recovery";

export interface TemporalPoint { position:number; trueCapability:number; observedOutcome:boolean; predictedProbability:number; }
export interface SyntheticTrajectory { seed:number; kind:TrajectoryKind; changePoint:number|null; recoveryStart:number|null; points:TemporalPoint[]; }
export interface TemporalValidationResult { kind:TrajectoryKind; stateRmse:number; changePointAbsoluteError:number|null; recoveryFactorError:number|null; falseChangeRate:number; points:number; }

function trajectoryState(kind:TrajectoryKind, position:number, length:number, base:number):number {
  const p=position/Math.max(1,length-1);
  if(kind==="stable") return base;
  if(kind==="gradual_decline") return clamp01(base-0.35*p);
  if(kind==="sudden_change") return clamp01(position<Math.floor(length*0.55)?base:base-0.35);
  const declineEnd=Math.floor(length*0.45), recoveryStart=Math.floor(length*0.7);
  if(position<declineEnd) return clamp01(base-0.3*(position/Math.max(1,declineEnd-1)));
  if(position<recoveryStart) return clamp01(base-0.3);
  const progress=(position-recoveryStart)/Math.max(1,length-recoveryStart-1);
  return clamp01(base-0.3+0.3*progress);
}

function estimateState(points:Array<{observedOutcome:boolean}>, window=8):number[] {
  return points.map((_,i)=>{ const start=Math.max(0,i-window+1); return mean(points.slice(start,i+1).map(p=>Number(p.observedOutcome))); });
}

function detectChange(states:number[], baselineWindow=8):number|null {
  if(states.length<baselineWindow*2) return null;
  const baseline=mean(states.slice(0,baselineWindow)); let best:number|null=null, magnitude=0;
  for(let i=baselineWindow;i<states.length;i++){ const local=mean(states.slice(Math.max(baselineWindow,i-baselineWindow+1),i+1)); const d=Math.abs(local-baseline); if(d>magnitude){magnitude=d;best=i;} }
  return magnitude>=0.12?best:null;
}

function recoveryFactor(points:TemporalPoint[], baselineEnd:number, lowStart:number, lowEnd:number, recoveryStart:number):number|null {
  const b=mean(points.slice(0,baselineEnd).map(p=>Number(p.observedOutcome)));
  const l=mean(points.slice(lowStart,lowEnd).map(p=>Number(p.observedOutcome)));
  const r=mean(points.slice(recoveryStart).map(p=>Number(p.observedOutcome)));
  const d=b-l; return Math.abs(d)<1e-9?null:(r-l)/d;
}

export function generateTemporalTrajectory(seed:number, kind:TrajectoryKind, length=60):SyntheticTrajectory {
  const rng=seededRng(seed), base=clamp01(0.68+normal(rng)*0.04);
  const changePoint=kind==="sudden_change"?Math.floor(length*0.55):kind==="gradual_decline"?Math.floor(length*0.65):null;
  const recoveryStart=kind==="recovery"?Math.floor(length*0.7):null;
  const points:TemporalPoint[]=[];
  for(let position=0;position<length;position++){
    const trueCapability=trajectoryState(kind,position,length,base);
    const probability=clamp01(sigmoid((trueCapability-0.5)*4));
    points.push({position,trueCapability,observedOutcome:rng()<probability,predictedProbability:probability});
  }
  return {seed,kind,changePoint,recoveryStart,points};
}

export function validateTemporalTrajectory(t:SyntheticTrajectory):TemporalValidationResult {
  const estimated=estimateState(t.points), stateRmse=rmse(estimated,t.points.map(p=>p.trueCapability));
  const detected=detectChange(estimated);
  const changePointAbsoluteError=t.changePoint!==null&&detected!==null?Math.abs(detected-t.changePoint):null;
  const baselineEnd=8, lowStart=t.kind==="recovery"?27:20, lowEnd=t.kind==="recovery"?42:30, recoveryStart=t.recoveryStart??52;
  const observedRecovery=recoveryFactor(t.points,baselineEnd,lowStart,lowEnd,recoveryStart);
  const recoveryFactorError=observedRecovery!==null&&t.kind==="recovery"?Math.abs(observedRecovery-1):null;
  return {kind:t.kind,stateRmse,changePointAbsoluteError,recoveryFactorError,falseChangeRate:t.kind==="stable"&&detected!==null?1:0,points:t.points.length};
}

export function runTemporalValidation(seeds:number[]=[101,202,303,404,505]):TemporalValidationResult[] {
  const kinds:TrajectoryKind[]=["stable","gradual_decline","sudden_change","recovery"];
  return seeds.flatMap(seed=>kinds.map(kind=>validateTemporalTrajectory(generateTemporalTrajectory(seed,kind))));
}
