export type AMCValidationType =
  | "AMC_SPEC" | "BLUEPRINT" | "PSYCHOMETRIC_EXTERNAL"
  | "SYNTHETIC" | "SECURITY" | "INTEGRATION";

export type AMCValidationStatus =
  | "PLANNED" | "RUNNING" | "PASSED" | "FAILED" | "INCONCLUSIVE" | "REJECTED";

export interface AMCValidationMetric {
  code: string;
  observedValue?: number;
  expectedValue?: number;
  tolerance?: number;
  direction: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER" | "TARGET_RANGE" | "EQUALITY";
  status: "PASS" | "FAIL" | "INCONCLUSIVE" | "NOT_APPLICABLE";
}

export interface AMCValidationRun {
  validationType: AMCValidationType;
  status: AMCValidationStatus;
  source?: string;
  sourceVersion?: string;
  datasetManifest: Record<string, unknown>;
  methodology: Record<string, unknown>;
  metrics: AMCValidationMetric[];
}

export const AMC_EXTERNAL_VALIDATION_SOURCES = {
  amcSpecifications: "https://www.amc.org.au/examination-specifications/",
  amcMcqSpecifications:
    "https://www.amc.org.au/wp-content/uploads/2025/09/2025-09-09-MCQ-Specifications-V8.pdf",
  amcClinical:
    "https://www.amc.org.au/pathways/standard-pathway/amc-assessments/clinical-examination/",
  pacer: "https://www.paceronline.com/",
} as const;

export const AMC_P7_REQUIRED_CHECKS = [
  "AMC_MCq_STRUCTURE",
  "AMC_MCq_BLUEPRINT",
  "AMC_CLINICAL_STRUCTURE",
  "AMC_TAXONOMY_COVERAGE",
  "IRT_EXTERNAL_CROSS_CHECK",
  "QUESTION_PARAMETER_STABILITY",
  "UNCERTAINTY_CALIBRATION",
  "SYNTHETIC_TRUTH_RECOVERY",
  "QUESTION_PROTECTION",
  "MISSING_DATA_ROBUSTNESS",
  "EXAM_NEUTRALITY",
  "SECURITY_BOUNDARY",
] as const;

/**
 * A validation result cannot become a certification decision merely because
 * a metric passes. P7 records evidence. P8 decides certification status.
 */
export function canProposeP8(runs: AMCValidationRun[]): boolean {
  const required = new Set<AMCValidationType>([
    "AMC_SPEC",
    "BLUEPRINT",
    "PSYCHOMETRIC_EXTERNAL",
    "SYNTHETIC",
    "SECURITY",
    "INTEGRATION",
  ]);
  return [...required].every(type => runs.some(run =>
    run.validationType === type &&
    run.status === "PASSED" &&
    run.metrics.every(m => m.status === "PASS" || m.status === "NOT_APPLICABLE"),
  ));
}
