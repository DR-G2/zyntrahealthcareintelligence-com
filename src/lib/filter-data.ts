// Shared filter data structures for Subject filtering

export const SUBJECTS = [
  'Medicine', 'Surgery', 'OB&G', 'Acute Medicine', 'Population Health', 'Basic Science'
] as const;

// Legacy aliases — many pages still import SYSTEMS
export const SYSTEMS = SUBJECTS;

// Legacy stubs for system/subject hierarchy (now flat)
export const SYSTEM_SUBJECTS: Record<string, string[]> = {};
SUBJECTS.forEach(s => { SYSTEM_SUBJECTS[s] = [s]; });

export const SUBJECT_SYSTEMS: Record<string, string[]> = {};
SUBJECTS.forEach(s => { SUBJECT_SYSTEMS[s] = [s]; });

export type FilterMode = 'system' | 'subject';

/** Get all pairs as a Set (legacy compat — returns subject:subject pairs) */
export function getAllPairs(): Set<string> {
  const allPairs = new Set<string>();
  SUBJECTS.forEach(s => { allPairs.add(`${s}:${s}`); });
  return allPairs;
}

/** Get matching DB categories from selected subjects/pairs */
export function getMatchingCategories(
  selectedPairs: Set<string>,
  categoryCounts: Record<string, number>
): string[] {
  if (selectedPairs.size === 0) return [];

  const selectedSubjects = new Set<string>();
  selectedPairs.forEach(pair => {
    const parts = pair.split(':');
    parts.forEach(p => selectedSubjects.add(p));
  });

  return Object.keys(categoryCounts).filter(cat => {
    const catLower = cat.toLowerCase();
    return Array.from(selectedSubjects).some(sub => catLower.includes(sub.toLowerCase()));
  });
}
