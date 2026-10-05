export const PIE_VALIDATION_CATALOG = [
  "001 capability recovery",
  "002 timing separation",
  "003 decision separation",
  "004 calibration recovery",
  "005 missing-data uncertainty robustness",
  "006 change-point recovery",
  "007 interruption recovery",
  "008 learning recovery",
  "009 question difficulty recovery",
  "010 bad-question protection",
  "011 missing-data robustness",
  "012 technical contamination",
  "013 equal-score separation",
  "014 false-separation resistance",
  "015 uncertainty convergence",
  "016 false-certainty resistance",
  "017 prior sensitivity",
  "018 exam neutrality",
  "019 decision validity",
  "020 causal validity",
] as const;

export type PIEValidationId = typeof PIE_VALIDATION_CATALOG[number];
