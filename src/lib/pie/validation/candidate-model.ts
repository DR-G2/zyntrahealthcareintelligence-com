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

/**
 * Development-only executable PIE candidate.
 *
 * This is deliberately NOT the final hierarchical dynamic state-space model.
 * It exists so the validation lab has a stable, inspectable model to challenge.
 * It estimates separate dimensions instead of producing one fixed-weight
 * readiness score.
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

  // This first estimator is intentionally transparent. It is a validation
  // instrument, not a production estimator and not a final psychometric model.
  const capabilitySignals = valid.map(o =>
    clamp01(o.outcome ? 0.55 + o.difficulty * 0.45 : o.difficulty * 0.25),
  );
  const capability = mean(capabilitySignals);

  const timingSignals = valid.map(o =>
    clamp01(1 - Math.abs(o.timePressure - (o.outcome ? 0.55 : 0.35))),
  );
  const timing = mean(timingSignals);

  const decisionSignals = valid.map(o =>
    o.answerChanged ? (o.finalCorrect ? 0.55 : 0.35) : 0.5,
  );
  const decision = mean(decisionSignals);

  const calibrationErrors = valid.map(o =>
    Math.abs(o.confidence - (o.outcome ? 1 : 0)),
  );
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

export function estimateOutcomeProbability(
  capability: number,
  difficulty: number,
  discrimination = 1,
): number {
  return sigmoid((capability - difficulty) * discrimination);
}
