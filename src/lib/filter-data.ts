// Shared filter data structures for System/Subject hierarchical filtering

export const SYSTEMS = [
  'Cardiology', 'Respiratory', 'Gastrointestinal', 'Neurology', 'Endocrinology',
  'Renal', 'Dermatology', 'Psychiatry', 'Paediatrics', 'Obstetrics & Gynaecology',
  'Emergency Medicine', 'Infectious Diseases', 'Population Health', 'ENT',
  'Haematology', 'Musculoskeletal', 'Surgery'
] as const;

export const SUBJECTS = [
  'Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation',
  'Investigations', 'Management', 'Preventive Medicine', 'Emergency Care',
  'Ethics & Law', 'Epidemiology'
] as const;

export const SYSTEM_SUBJECTS: Record<string, string[]> = {
  'Cardiology': ['Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation', 'Investigations', 'Management', 'Emergency Care'],
  'Respiratory': ['Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation', 'Investigations', 'Management', 'Emergency Care'],
  'Gastrointestinal': ['Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation', 'Investigations', 'Management'],
  'Neurology': ['Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation', 'Investigations', 'Management', 'Emergency Care'],
  'Endocrinology': ['Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation', 'Investigations', 'Management'],
  'Renal': ['Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation', 'Investigations', 'Management'],
  'Dermatology': ['Pathology', 'Clinical Presentation', 'Management'],
  'Psychiatry': ['Pathology', 'Clinical Presentation', 'Pharmacology', 'Management'],
  'Paediatrics': ['Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation', 'Management', 'Emergency Care'],
  'Obstetrics & Gynaecology': ['Physiology', 'Pathology', 'Clinical Presentation', 'Investigations', 'Management', 'Emergency Care'],
  'Emergency Medicine': ['Clinical Presentation', 'Investigations', 'Management', 'Emergency Care'],
  'Infectious Diseases': ['Pathology', 'Pharmacology', 'Clinical Presentation', 'Investigations', 'Management', 'Epidemiology'],
  'Population Health': ['Preventive Medicine', 'Ethics & Law', 'Epidemiology'],
  'ENT': ['Pathology', 'Clinical Presentation', 'Investigations', 'Management'],
  'Haematology': ['Physiology', 'Pathology', 'Pharmacology', 'Clinical Presentation', 'Investigations', 'Management'],
  'Musculoskeletal': ['Pathology', 'Clinical Presentation', 'Investigations', 'Management', 'Pharmacology'],
  'Surgery': ['Pathology', 'Clinical Presentation', 'Investigations', 'Management', 'Emergency Care', 'Pharmacology'],
};

export const SUBJECT_SYSTEMS: Record<string, string[]> = {};
SUBJECTS.forEach(subject => {
  SUBJECT_SYSTEMS[subject] = SYSTEMS.filter(system => SYSTEM_SUBJECTS[system]?.includes(subject));
});

export type FilterMode = 'system' | 'subject';

/** Get all pairs as a Set */
export function getAllPairs(): Set<string> {
  const allPairs = new Set<string>();
  SYSTEMS.forEach(system => {
    SYSTEM_SUBJECTS[system]?.forEach(subject => {
      allPairs.add(`${system}:${subject}`);
    });
  });
  return allPairs;
}

/** Get matching DB categories from selected pairs */
export function getMatchingCategories(
  selectedPairs: Set<string>,
  categoryCounts: Record<string, number>
): string[] {
  if (selectedPairs.size === 0) return [];

  const selectedSystems = new Set<string>();
  const selectedSubjects = new Set<string>();

  selectedPairs.forEach(pair => {
    const [system, subject] = pair.split(':');
    selectedSystems.add(system);
    selectedSubjects.add(subject);
  });

  return Object.keys(categoryCounts).filter(cat => {
    const catLower = cat.toLowerCase();
    return Array.from(selectedSystems).some(sys => catLower.includes(sys.toLowerCase())) ||
           Array.from(selectedSubjects).some(sub => catLower.includes(sub.toLowerCase()));
  });
}
