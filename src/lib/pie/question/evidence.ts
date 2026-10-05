import { QuestionObservation } from "./types";

export interface QuestionEvidenceSummary {
  uniqueCandidates: number;
  validObservations: number;
  suspiciousObservations: number;
  contradictoryObservations: number;
  outcomeVariance: number;
  candidateCapabilityCoverage: number;
  replicationQuality: number;
}

export function summarizeQuestionEvidence(
  observations: QuestionObservation[],
): QuestionEvidenceSummary {
  const uniqueCandidates = new Set(observations.map(o => o.candidateId)).size;
  const valid = observations.filter(o => !o.observationQuality || o.observationQuality === "VALID");
  const suspicious = observations.filter(o => o.observationQuality === "SUSPICIOUS").length;
  const contradictory = observations.filter(o => o.observationQuality === "CONTRADICTORY").length;
  const outcomes = valid.map(o => o.outcome);
  const mean = outcomes.length ? outcomes.reduce((a,b)=>a+b,0)/outcomes.length : 0;
  const variance = outcomes.length ? outcomes.reduce((s,v)=>s+(v-mean)**2,0)/outcomes.length : 0;

  const capabilities = valid.map(o => o.candidateCapabilityEstimate);
  const coverage = capabilities.length
    ? Math.max(0, Math.min(1, Math.max(...capabilities) - Math.min(...capabilities)))
    : 0;

  return {
    uniqueCandidates,
    validObservations: valid.length,
    suspiciousObservations: suspicious,
    contradictoryObservations: contradictory,
    outcomeVariance: variance,
    candidateCapabilityCoverage: coverage,
    replicationQuality: Math.max(
      0,
      Math.min(
        1,
        (uniqueCandidates / 20) *
          (valid.length / Math.max(1, observations.length)) *
          (0.5 + 0.5 * coverage),
      ),
    ),
  };
}
