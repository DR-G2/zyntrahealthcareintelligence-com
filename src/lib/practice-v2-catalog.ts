import { getSupabaseV2 } from '@/integrations/supabase/v2-client';

/**
 * Practice setup catalogue, read from V2 (the project the PIE drill serves from).
 * Counts are per SUBJECT only, from the DEFINER RPC get_practice_subject_counts (0085).
 * Subtopic names come from public.subtopics without counts.
 * If the RPC is not deployed yet, falls back to a direct id/subject_id read of active
 * questions (works until the paid-only lock revokes SELECT on public.questions).
 * Never reads stems, options, answer keys or explanations.
 */
export interface V2CatalogSubject { id: string; name: string; display_order: number | null }
export interface V2CatalogSubtopic { id: string; name: string; subject_id: string; display_order: number | null }
export interface V2SubjectCount { subject_id: string; question_count: number }

export interface V2PracticeCatalog {
  subjects: V2CatalogSubject[];
  subtopics: V2CatalogSubtopic[];
  subjectCounts: V2SubjectCount[];
  total: number;
  countSource: 'rpc' | 'direct_select';
}

type Client = Pick<ReturnType<typeof getSupabaseV2>, 'from' | 'rpc'>;

const PAGE_SIZE = 1000;

/** PostgREST "function not found" (PGRST202) or Postgres undefined_function (42883). */
function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '');
}

async function directSubjectCounts(client: Client): Promise<V2SubjectCount[]> {
  const counts = new Map<string, number>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('questions')
      .select('id, subject_id')
      .eq('status', 'active')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const q of data as Array<{ subject_id: string | null }>) {
      if (q.subject_id) counts.set(q.subject_id, (counts.get(q.subject_id) ?? 0) + 1);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return [...counts].map(([subject_id, question_count]) => ({ subject_id, question_count }));
}

export async function fetchV2PracticeCatalog(client: Client = getSupabaseV2()): Promise<V2PracticeCatalog> {
  const [subjectsRes, subtopicsRes, countsRes] = await Promise.all([
    client.from('subjects').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
    client.from('subtopics').select('id, name, subject_id, sort_order').eq('is_active', true).order('sort_order'),
    client.rpc('get_practice_subject_counts'),
  ]);
  if (subjectsRes.error) throw subjectsRes.error;
  if (subtopicsRes.error) throw subtopicsRes.error;

  let subjectCounts: V2SubjectCount[];
  let countSource: V2PracticeCatalog['countSource'] = 'rpc';
  if (countsRes.error) {
    if (!isMissingRpc(countsRes.error)) throw countsRes.error;
    subjectCounts = await directSubjectCounts(client);
    countSource = 'direct_select';
  } else {
    subjectCounts = ((countsRes.data ?? []) as V2SubjectCount[]).map((r) => ({ subject_id: r.subject_id, question_count: Number(r.question_count) }));
  }

  const subjects = ((subjectsRes.data ?? []) as Array<{ id: string; name: string; sort_order: number | null }>)
    .map((s) => ({ id: s.id, name: s.name, display_order: s.sort_order }));
  const activeIds = new Set(subjects.map((s) => s.id));
  subjectCounts = subjectCounts.filter((c) => activeIds.has(c.subject_id));

  return {
    subjects,
    subtopics: ((subtopicsRes.data ?? []) as Array<{ id: string; name: string; subject_id: string; sort_order: number | null }>)
      .map((s) => ({ id: s.id, name: s.name, subject_id: s.subject_id, display_order: s.sort_order })),
    subjectCounts,
    total: subjectCounts.reduce((n, c) => n + c.question_count, 0),
    countSource,
  };
}

/** Active-question counts keyed by subject name. Subtopics carry no counts. */
export function countV2Catalog(catalog: V2PracticeCatalog) {
  const subjectName = new Map(catalog.subjects.map((s) => [s.id, s.name]));
  const categoryCounts: Record<string, number> = {};
  for (const c of catalog.subjectCounts) {
    const sn = subjectName.get(c.subject_id);
    if (sn) categoryCounts[sn] = (categoryCounts[sn] || 0) + c.question_count;
  }
  return { categoryCounts, subtopicCounts: {} as Record<string, number> };
}
