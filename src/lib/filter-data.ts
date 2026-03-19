// Shared filter data structures for Subject filtering

export const SUBJECTS = [
  'Medicine', 'Surgery', 'OB&G', 'Acute Medicine', 'Population Health', 'Basic Science'
] as const;

export type FilterMode = 'subject';

/** Get matching DB categories from selected subjects */
export function getMatchingCategories(
  selectedSubjects: Set<string>,
  categoryCounts: Record<string, number>
): string[] {
  if (selectedSubjects.size === 0) return [];

  return Object.keys(categoryCounts).filter(cat => {
    const catLower = cat.toLowerCase();
    return Array.from(selectedSubjects).some(sub => catLower.includes(sub.toLowerCase()));
  });
}
