import { SyntheticObservation } from "./synthetic";
import { brierScore, mean, spearman } from "./metrics";

export interface CandidateTruth {
  capability: number;
  timing: number;
  decision: number;
  calibration: number;
}

export interface BaselineEstimate {
  model: string;
  capability: number;
  timing: number;
  decision: number;
  calibration: number;
  outcomeProbability: number;
}

export interface ModelComparison {
  model: string;
  capabilityError: number;
  capabilityRankCorrelation: number;
  outcomeBrier: number;
  calibrationBrier: number;
}

export function legacyBaseline(observations: SyntheticObservation[]): BaselineEstimate {
  const valid = observations.filter(o => !o.missing);
  const accuracy = valid.length ? mean(valid.map(o => Number(o.outcome))) : 0.5;
  const meanDifficulty = valid.length ? mean(valid.map(o => o.difficulty)) : 0.5;

  return {
    model: "legacy_baseline",
    capability: accuracy,
    timing: accuracy,
    decision: accuracy,
    calibration: accuracy,
    outcomeProbability: accuracy,
  };
}

export function pieCandidateBaseline(observations: SyntheticObservation[]): BaselineEstimate {
  const valid = observations.filter(o => !o.missing);
  const outcomeProbability = valid.length ? mean(valid.map(o => Number(o.outcome))) : 0.5;

  const timingPressure = valid.length ? mean(valid.map(o => o.timePressure)) : 0.5;
  const timing = Math.max(0, Math.min(1, 1 - Math.abs(timingPressure - 0.5)));

  const changed = valid.filter(o => o.answerChanged);
  const decision = changed.length
    ? mean(changed.map(o => Number(o.finalCorrect)))
    : outcomeProbability;

  const calibrationBrier = valid.length
    ? brierScore(valid.map(o => o.confidence), valid.map(o => Number(o.outcome)))
    : 0.25;

  return {
    model: "pie_development_baseline",
    capability: outcomeProbability,
    timing,
    decision,
    calibration: Math.max(0, Math.min(1, 1 - calibrationBrier)),
    outcomeProbability,
  };
}

export function compareCandidateModels(
  truth: CandidateTruth[],
  legacy: BaselineEstimate[],
  pie: BaselineEstimate[],
): ModelComparison[] {
  const evaluate = (model: string, estimates: BaselineEstimate[]): ModelComparison => {
    const truthCapability = truth.map(t => t.capability);
    const predictedCapability = estimates.map(e => e.capability);
    const observedOutcome = estimates.map(e => e.outcomeProbability);
    const outcomeTruth = truth.map(t => t.capability);

    return {
      model,
      capabilityError: mean(predictedCapability.map((p, i) => Math.abs(p - truthCapability[i]))),
      capabilityRankCorrelation: spearman(predictedCapability, truthCapability),
      outcomeBrier: brierScore(observedOutcome, outcomeTruth),
      calibrationBrier: mean(estimates.map(e => (e.calibration - truth[estimates.indexOf(e)].calibration) ** 2)),
    };
  };

  return [evaluate("legacy_baseline", legacy), evaluate("pie_development_baseline", pie)];
}
