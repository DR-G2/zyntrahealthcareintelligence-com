import { CandidateState, PieDimension, PieObservation } from "./types";

export type HypothesisKind =
  | "CAPABILITY"
  | "DECISION"
  | "TIMING"
  | "CALIBRATION"
  | "SUSTAINED_PERFORMANCE"
  | "LEARNING";

export interface CompetingHypothesis {
  id: string;
  state: HypothesisKind;
  description: string;
  predictedSignal: string;
  evidenceFor: number;
  evidenceAgainst: number;
  separation: number;
}

export interface IdentifiabilityResult {
  status: CandidateState["identificationStatus"];
  hypotheses: CompetingHypothesis[];
  unresolvedDimensions: PieDimension[];
}

export function evaluateIdentifiability(
  state: CandidateState,
  observations: PieObservation[],
): IdentifiabilityResult {
  const hypotheses: CompetingHypothesis[] = [
    {
      id: "H-CAPABILITY",
      state: "CAPABILITY",
      description: "Observed performance differences are primarily capability-related.",
      predictedSignal: "Performance remains informative after accounting for task difficulty.",
      evidenceFor: state.capability.evidenceCount,
      evidenceAgainst: Math.max(0, observations.length - state.capability.evidenceCount),
      separation: state.capability.evidenceQuality * (1 - Math.min(1, state.capability.variance)),
    },
    {
      id: "H-TIMING",
      state: "TIMING",
      description: "Observed differences are primarily timing or pressure-related.",
      predictedSignal: "Performance changes when timing pressure changes.",
      evidenceFor: state.timing.evidenceCount,
      evidenceAgainst: Math.max(0, observations.length - state.timing.evidenceCount),
      separation: state.timing.evidenceQuality * (1 - Math.min(1, state.timing.variance)),
    },
    {
      id: "H-DECISION",
      state: "DECISION",
      description: "Observed differences are primarily decision-behaviour-related.",
      predictedSignal: "First-to-final answer behaviour separates under comparable task demand.",
      evidenceFor: state.decision.evidenceCount,
      evidenceAgainst: Math.max(0, observations.length - state.decision.evidenceCount),
      separation: state.decision.evidenceQuality * (1 - Math.min(1, state.decision.variance)),
    },
    {
      id: "H-CALIBRATION",
      state: "CALIBRATION",
      description: "Observed differences are primarily confidence/outcome calibration-related.",
      predictedSignal: "Confidence tracks outcome probability under comparable demand.",
      evidenceFor: state.calibration.evidenceCount,
      evidenceAgainst: Math.max(0, observations.length - state.calibration.evidenceCount),
      separation: state.calibration.evidenceQuality * (1 - Math.min(1, state.calibration.variance)),
    },
  ];

  const unresolvedDimensions: PieDimension[] = hypotheses
    .filter(h => h.separation < 0.45)
    .map(h => h.state);

  const status =
    unresolvedDimensions.length <= 1 && hypotheses.every(h => h.evidenceFor >= 6)
      ? "IDENTIFIED_FOR_DECISION"
      : hypotheses.some(h => h.evidenceFor >= 6 && h.separation >= 0.35)
        ? "PROVISIONALLY_IDENTIFIED"
        : "UNRESOLVED";

  return { status, hypotheses, unresolvedDimensions };
}
