export type DatasetClass =
  | "verified_real_candidate"
  | "certification_or_test"
  | "synthetic"
  | "unknown"
  | "excluded";

export interface ProvenanceInput {
  source?: string | null;
  registeredSynthetic?: boolean;
  explicitlyApprovedRealSource?: boolean;
}

/**
 * Conservative eligibility classifier for offline PIE training.
 *
 * Unknown sources are never promoted to human data by inference. A source may
 * be marked explicitly approved only after a separate governance review.
 */
export function classifyTrainingProvenance(input: ProvenanceInput): DatasetClass {
  if (input.registeredSynthetic === true) return "synthetic";

  const source = (input.source ?? "").trim().toLowerCase();
  if (!source) return "unknown";

  if (/synthetic|fixture|seed(?:$|[-_ ])|mock|demo/.test(source)) {
    return "synthetic";
  }

  if (/certification|cert(?:$|[-_ ])|test|smoke|qa|staging|e2e/.test(source)) {
    return "certification_or_test";
  }

  if (input.explicitlyApprovedRealSource === true) {
    return "verified_real_candidate";
  }

  return "unknown";
}

export function isEligibleForHumanTraining(datasetClass: DatasetClass): boolean {
  return datasetClass === "verified_real_candidate";
}
