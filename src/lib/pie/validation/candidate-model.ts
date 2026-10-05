import { clamp01, sigmoid, SyntheticObservation } from "./synthetic";
import { mean } from "./metrics";

export interface CandidateEstimate {
  capability: number;
  timing: number;
  decision: number;
  calibration: number;
  uncertainty: {
    capability: number;
    timing: number;
    decision: number;
    calibration: number;
  };
  evidenceCount: number;
}

function weightedMean(values: number[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  return total ? values.reduce((s, v, i) => s + v * weights[i], 0) / total : 0.5;
}

/**
 * Development-only executable PIE candidate.
 *
 * This is deliberately NOT the final hierarchical dynamic state-space model.
 * It exists so the validation lab has a stable, inspectable model to challenge.
 * It estimates separate dimensions from conditional evidence instead of producing
 * one fixed-weight readiness score.
 */
export function estimateCandidateState(observations: SyntheticObservation[]): CandidateEstimate {
  const valid = observations.filter(o => !o.missing);

  if (!valid.length) {
    return {
      capability: 0.5,
      timing: 0.5,
      decision: 0.5,
      calibration: 0.5,
      uncertainty: { capability: 0.5, timing: 0.5, decision: 0.5, calibration: 0.5 },
      evidenceCount: 0,
    };
  }

  const capabilitySignals = valid.map(o => clamp01(o.outcome ? o.difficulty + 0.5 : o.difficulty - 0.25));
  const capabilityWeights = valid.map(o => 0.6 + o.discriminationSafe());
  const capability = weightedMean(capabilitySignals, capabilityWeights);

  const timingSignals = valid.map(o => clamp01(1 - Math.abs(o.timePressure - (o.outcome ? 0.55 : 0.35))));
  const timing = mean(timingSignals);

  const decisionSignals = valid.map(o => o.answerChanged ? (o.finalCorrect ? 0.55 : 0.35) : 0.5);
  const decision = mean(decisionSignals);

  const calibrationErrors = valid.map(o => Math.abs(o.confidence - (o.outcome ? 1 : 0)));
  const calibration = clamp01(1 - mean(calibrationErrors));

  const evidenceFactor = Math.min(1, Math.sqrt(valid.length / 40));
  const baseUncertainty = 0.5 * (1 - evidenceFactor);

  return {
    capability,
    timing,
    decision,
    calibration,
    uncertainty: {
      capability: baseUncertainty,
      timing: baseUncertainty,
      decision: baseUncertainty,
      calibration: baseUncertainty,
    },
    evidenceCount: valid.length,
  };
}

declare global {
  interface Object {
    discriminationSafe?: () => number;
  }
}

export function attachQuestionDiscrimination(observations: SyntheticObservation[], discrimination = 1): SyntheticObservation[] {
  return observations.map(o => ({ ...o, discrimination }));
}

// Kept local to avoid storing production-only question parameters in the observation contract.
(SyntheticObservation.prototype as unknown as { discriminationSafe?: () => number }).discriminationSafe = function () {
  return 0.5;
};

export function estimateOutcomeProbability(capability: number, difficulty: number, discrimination = 1): number {
  return sigmoid((capability - difficulty) * discrimination);
}
