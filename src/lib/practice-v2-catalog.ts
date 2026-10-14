import { getSupabaseV2 } from '@/integrations/supabase/v2-client';

/**
 * Practice setup catalogue, read from V2 (the project the PIE drill serves from).
 * Counts are per SUBJECT only, from the DEFINER RPC get_practice_subject_counts (0085).
 * Subtopic names come from public.subtopics without counts.
 * The RPC is a hard prerequisite (migration 0085): any RPC error is thrown; there is no
 * direct read of public.questions.
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
}

type Client = Pick<ReturnType<typeof getSupabaseV2>, 'from' | 'rpc'>;

export async function fetchV2PracticeCatalog(client: Client = getSupabaseV2()): Promise<V2PracticeCatalog> {
  const [subjectsRes, subtopicsRes, countsRes] = await Promise.all([
    client.from('subjects').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
    client.from('subtopics').select('id, name, subject_id, sort_order').eq('is_active', true).order('sort_order'),
    client.rpc('get_practice_subject_counts'),
  ]);
  if (subjectsRes.error) throw subjectsRes.error;
  if (subtopicsRes.error) throw subtopicsRes.error;

  if (countsRes.error) throw countsRes.error;
  let subjectCounts: V2SubjectCount[] = ((countsRes.data ?? []) as V2SubjectCount[])
    .map((r) => ({ subject_id: r.subject_id, question_count: Number(r.question_count) }));

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

export interface PracticeStatusCounts { attempted: number; correct: number; incorrect: number }

/** PostgREST "function not found" (PGRST202) or Postgres undefined_function (42883) only. */
export function isMissingRpc(error: { code?: string } | null | undefined): boolean {
  return !!error && (error.code === 'PGRST202' || error.code === '42883');
}

/**
 * Caller's own practice status counts via get_my_practice_status_counts() (counts only, no content).
 * Returns 0s ONLY when the RPC is not deployed yet (PGRST202 / 42883); every other error
 * (including 42501) is thrown.
 */
export async function fetchMyPracticeStatusCounts(client: Pick<Client, 'rpc'> = getSupabaseV2()): Promise<PracticeStatusCounts> {
  const { data, error } = await client.rpc('get_my_practice_status_counts');
  if (error) {
    if (isMissingRpc(error)) return { attempted: 0, correct: 0, incorrect: 0 };
    throw error;
  }
  const row = (Array.isArray(data) ? data[0] : data) as Partial<PracticeStatusCounts> | null;
  return { attempted: Number(row?.attempted ?? 0), correct: Number(row?.correct ?? 0), incorrect: Number(row?.incorrect ?? 0) };
}
