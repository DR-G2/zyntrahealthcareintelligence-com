// Fixed server-side allowlist of clinical subject/category labels that may be
// placed into AI prompts. Caller text never reaches a prompt unless it matches.
const LABELS = [
  // Learner subjects
  "Adult Medicine", "Adult Surgery", "Women's Health", "Child Health", "Mental Health",
  "Population Health & Ethics", "Embryology", "Genetics", "Immunology", "Microbiology",
  "Pathology", "Pharmacology", "Ethics & Law",
  // Core subjects
  "Medicine", "Surgery", "OB&G", "Acute Medicine", "Population Health", "Basic Science",
  // Specialty categories
  "Cardiology", "Respiratory", "Gastroenterology", "Gastrointestinal", "Neurology", "Endocrinology",
  "Nephrology", "Renal", "Rheumatology", "Haematology", "Infectious Disease", "Infectious Diseases",
  "Dermatology", "Psychiatry", "Obstetrics", "Gynaecology", "Obstetrics & Gynaecology", "Paediatrics",
  "Ophthalmology", "ENT", "Emergency Medicine", "Musculoskeletal", "General Medicine",
];

const BY_KEY = new Map(LABELS.map((l) => [l.toLowerCase(), l]));

/** Returns the canonical allowlisted label, or null when the value is not allowlisted. */
export function allowedClinicalLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return BY_KEY.get(value.trim().toLowerCase()) ?? null;
}
