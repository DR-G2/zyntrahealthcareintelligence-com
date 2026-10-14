import { getSupabaseV2 } from '@/integrations/supabase/v2-client';

/**
 * Practice setup catalogue, read from V2 (the project the PIE drill serves from).
 * Only ids, names, ordering and active status are read: never stems, options,
 * answer keys or explanations (authenticated has no SELECT on questions.explanation).
 */
export interface V2CatalogSubject { id: string; name: string; display_order: number | null }
export interface V2CatalogSubtopic { id: string; name: string; subject_id: string; display_order: number | null }
export interface V2CatalogQuestion { id: string; subject_id: string | null; subtopic_id: string | null }

export interface V2PracticeCatalog {
  subjects: V2CatalogSubject[];
  subtopics: V2CatalogSubtopic[];
  questions: V2CatalogQuestion[];
}

type Client = Pick<ReturnType<typeof getSupabaseV2>, 'from'>;

const PAGE_SIZE = 1000;

export async function fetchV2PracticeCatalog(client: Client = getSupabaseV2()): Promise<V2PracticeCatalog> {
  const [subjectsRes, subtopicsRes] = await Promise.all([
    client.from('subjects').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
    client.from('subtopics').select('id, name, subject_id, sort_order').eq('is_active', true).order('sort_order'),
  ]);
  if (subjectsRes.error) throw subjectsRes.error;
  if (subtopicsRes.error) throw subtopicsRes.error;

  const questions: V2CatalogQuestion[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('questions')
      .select('id, subject_id, subtopic_id')
      .eq('status', 'active')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    questions.push(...(data as V2CatalogQuestion[]));
    if (data.length < PAGE_SIZE) break;
  }

  return {
    subjects: ((subjectsRes.data ?? []) as Array<{ id: string; name: string; sort_order: number | null }>)
      .map((s) => ({ id: s.id, name: s.name, display_order: s.sort_order })),
    subtopics: ((subtopicsRes.data ?? []) as Array<{ id: string; name: string; subject_id: string; sort_order: number | null }>)
      .map((s) => ({ id: s.id, name: s.name, subject_id: s.subject_id, display_order: s.sort_order })),
    questions,
  };
}

/** Counts active questions per subject name and per subtopic name, by id (no text matching). */
export function countV2Catalog(catalog: V2PracticeCatalog) {
  const subjectName = new Map(catalog.subjects.map((s) => [s.id, s.name]));
  const subtopicName = new Map(catalog.subtopics.map((s) => [s.id, s.name]));
  const categoryCounts: Record<string, number> = {};
  const subtopicCounts: Record<string, number> = {};
  for (const q of catalog.questions) {
    const sn = q.subject_id ? subjectName.get(q.subject_id) : undefined;
    if (sn) categoryCounts[sn] = (categoryCounts[sn] || 0) + 1;
    const tn = q.subtopic_id ? subtopicName.get(q.subtopic_id) : undefined;
    if (tn) subtopicCounts[tn] = (subtopicCounts[tn] || 0) + 1;
  }
  return { categoryCounts, subtopicCounts };
}
