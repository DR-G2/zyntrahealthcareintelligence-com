import { CandidateState, StatePosterior } from "./types";

export interface DynamicState {
  stability: number;
  recovery: number;
  elasticity: number;
  inertia: number;
  velocity: number;
  changePointProbability: number;
  sustainedPerformanceDeclineEstimate: number;
  uncertainty: number;
  evidenceCount: number;
}

function delta(a: StatePosterior, b: StatePosterior): number {
  return b.estimate - a.estimate;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
}

export function deriveDynamics(history: CandidateState[]): DynamicState {
  if (history.length < 2) {
    return {
      stability: 0,
      recovery: 0,
      elasticity: 0,
      inertia: 0,
      velocity: 0,
      changePointProbability: 0,
      sustainedPerformanceDeclineEstimate: 0,
      uncertainty: 1,
      evidenceCount: history.length,
    };
  }

  const capability = history.map(s => s.capability.estimate);
  const sustained = history.map(s => s.sustainedPerformance.estimate);
  const velocities = history.slice(1).map((s,i)=>capability[i+1]-capability[i]);
  const variance = mean(velocities.map(v=>v*v));
  const stability = 1 / (1 + variance * 100);
  const velocity = velocities.at(-1) ?? 0;

  const before = mean(sustained.slice(0, Math.max(1, Math.floor(sustained.length*0.25))));
  const late = mean(sustained.slice(Math.max(0, Math.floor(sustained.length*0.75))));
  const mid = mean(sustained.slice(Math.max(0, Math.floor(sustained.length*0.4)), Math.max(1, Math.floor(sustained.length*0.6))));
  const recoveryDenominator = before - mid;
  const recovery = Math.abs(recoveryDenominator) < 1e-8 ? 0 : Math.max(-1, Math.min(2, (late-mid)/recoveryDenominator));

  const pressureChanges = history.slice(1).map((s,i)=>Math.abs((s.timing.estimate-s.capability.estimate)-(history[i].timing.estimate-history[i].capability.estimate)));
  const elasticity = mean(pressureChanges);

  const earlyDelta = Math.abs(delta(history[0].capability, history[Math.floor(history.length/2)].capability));
  const lateDelta = Math.abs(delta(history[Math.floor(history.length/2)].capability, history.at(-1)!.capability));
  const inertia = earlyDelta < 1e-8 ? 0 : Math.max(0, Math.min(1, lateDelta / earlyDelta));

  const changePointProbability = Math.min(1, Math.abs(velocity) * 8);
  const sustainedPerformanceDeclineEstimate = Math.max(0, before-late);
  const uncertainty = mean(history.at(-1) ? [
    history.at(-1)!.capability.variance,
    history.at(-1)!.timing.variance,
    history.at(-1)!.sustainedPerformance.variance,
  ] : [1]);

  return {
    stability,
    recovery,
    elasticity,
    inertia,
    velocity,
    changePointProbability,
    sustainedPerformanceDeclineEstimate,
    uncertainty,
    evidenceCount: history.length,
  };
}
