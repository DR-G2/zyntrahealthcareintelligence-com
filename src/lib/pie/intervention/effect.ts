import type { InterventionOutcome, InterventionEffectEstimate } from "./types";

const mean = (x: number[]) => x.length ? x.reduce((a,b)=>a+b,0)/x.length : 0;

export function estimateDescriptiveEffect(
  outcomes: InterventionOutcome[],
): InterventionEffectEstimate {
  const valid = outcomes.filter(o => o.completed && o.outcomeQuality > 0);
  const treatment = valid.map(o => o.immediateValue ?? o.transferValue ?? o.delayedValue ?? o.baselineValue);
  const baseline = valid.map(o => o.baselineValue);
  const effect = mean(treatment) - mean(baseline);
  const variance = valid.length > 1
    ? mean(treatment.map(x => (x - mean(treatment)) ** 2))
    : 1;

  return {
    interventionId: outcomes[0]?.interventionId ?? "unknown",
    targetDimension: "UNSPECIFIED",
    treatmentMean: mean(treatment),
    comparisonMean: mean(baseline),
    effectEstimate: effect,
    uncertainty: Math.sqrt(variance / Math.max(1, valid.length)),
    sampleSize: valid.length,
    evidenceQuality: valid.length ? mean(valid.map(o=>o.outcomeQuality)) : 0,
    confoundingRisk: 1,
    design: "DESCRIPTIVE",
    causalStatus: "NOT_CAUSAL",
  };
}

export interface ContrastGroup {
  interventionId: string;
  outcomes: InterventionOutcome[];
}

export function estimateBetweenGroupContrast(
  treatment: ContrastGroup,
  comparison: ContrastGroup,
): InterventionEffectEstimate {
  const t = treatment.outcomes.filter(o => o.completed && o.outcomeQuality > 0)
    .map(o => (o.immediateValue ?? o.transferValue ?? o.delayedValue ?? o.baselineValue) - o.baselineValue);
  const c = comparison.outcomes.filter(o => o.completed && o.outcomeQuality > 0)
    .map(o => (o.immediateValue ?? o.transferValue ?? o.delayedValue ?? o.baselineValue) - o.baselineValue);

  const treatmentMean = mean(t);
  const comparisonMean = mean(c);
  const effect = treatmentMean - comparisonMean;
  const pooledN = Math.max(1, t.length + c.length);
  const variance = pooledN > 1
    ? mean([...t.map(x=>(x-treatmentMean)**2), ...c.map(x=>(x-comparisonMean)**2)])
    : 1;

  return {
    interventionId: treatment.interventionId,
    targetDimension: "UNSPECIFIED",
    treatmentMean,
    comparisonMean,
    effectEstimate: effect,
    uncertainty: Math.sqrt(variance / pooledN),
    sampleSize: pooledN,
    evidenceQuality: mean([
      t.length ? 1 : 0,
      c.length ? 1 : 0,
    ]),
    confoundingRisk: 0.5,
    design: "QUASI_EXPERIMENTAL",
    causalStatus: "NOT_CAUSAL",
  };
}

export function causalClaimAllowed(effect: InterventionEffectEstimate): boolean {
  return (
    effect.design === "RANDOMIZED" &&
    effect.sampleSize >= 30 &&
    effect.uncertainty < Math.max(0.1, Math.abs(effect.effectEstimate) * 0.5) &&
    effect.confoundingRisk < 0.25
  );
}
