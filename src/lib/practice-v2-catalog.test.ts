import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { countV2Catalog, fetchV2PracticeCatalog } from './practice-v2-catalog';

type Call = { table: string; cols: string; filters: string[] };
function fakeClient(tables: Record<string, unknown[]>, rpc: { data?: unknown; error?: unknown }, calls: Call[], rpcCalls: string[]) {
  return {
    rpc(fn: string) { rpcCalls.push(fn); return Promise.resolve({ data: rpc.data ?? null, error: rpc.error ?? null }); },
    from(table: string) {
      const call: Call = { table, cols: '', filters: [] };
      calls.push(call);
      let start = 0, end = Infinity;
      const q: any = {
        select(c: string) { call.cols = c; return q; },
        eq(k: string, v: unknown) { call.filters.push(`${k}=${v}`); return q; },
        order() { return q; },
        range(a: number, b: number) { start = a; end = b; return q; },
        then(res: any) { return Promise.resolve({ data: tables[table].slice(start, end + 1), error: null }).then(res); },
      };
      return q;
    },
  } as any;
}
const tables = {
  subjects: [{ id: 's1', name: 'Population Health & Ethics', sort_order: 9 }, { id: 's2', name: 'Anatomy', sort_order: 1 }],
  subtopics: [{ id: 't1', name: 'Screening', subject_id: 's1', sort_order: 1 }],
  questions: [{ id: 'q1', subject_id: 's1' }, { id: 'q2', subject_id: 's1' }, { id: 'q3', subject_id: 's2' }],
};

describe('V2 practice catalog', () => {
  it('uses get_practice_subject_counts (per subject only) and never reads questions directly', async () => {
    const calls: Call[] = []; const rpcCalls: string[] = [];
    const cat = await fetchV2PracticeCatalog(fakeClient(tables, { data: [{ subject_id: 's1', question_count: 414 }, { subject_id: 's2', question_count: 25 }] }, calls, rpcCalls));
    expect(rpcCalls).toEqual(['get_practice_subject_counts']);
    expect(calls.some((c) => c.table === 'questions')).toBe(false);
    expect(cat.countSource).toBe('rpc');
    expect(cat.total).toBe(439);
    expect(countV2Catalog(cat)).toEqual({ categoryCounts: { 'Population Health & Ethics': 414, Anatomy: 25 }, subtopicCounts: {} });
    expect(cat.subtopics.map((s) => s.name)).toEqual(['Screening']);
  });

  it('falls back to a direct id/subject_id read only when the RPC is missing', async () => {
    const calls: Call[] = []; const rpcCalls: string[] = [];
    const cat = await fetchV2PracticeCatalog(fakeClient(tables, { error: { code: 'PGRST202', message: 'Could not find the function' } }, calls, rpcCalls));
    expect(cat.countSource).toBe('direct_select');
    expect(countV2Catalog(cat).categoryCounts).toEqual({ 'Population Health & Ethics': 2, Anatomy: 1 });
    const q = calls.find((c) => c.table === 'questions')!;
    expect(q.cols).toBe('id, subject_id');
    expect(q.filters).toContain('status=active');
    for (const c of calls) expect(c.cols).not.toMatch(/explanation|stem|correct_answer|options/);
  });

  it('surfaces other RPC errors (e.g. 42501) instead of silently falling back', async () => {
    await expect(fetchV2PracticeCatalog(fakeClient(tables, { error: { code: '42501', message: 'permission denied' } }, [], []))).rejects.toMatchObject({ code: '42501' });
  });

  it('Practice setup no longer reads questions from the legacy client', () => {
    const src = readFileSync('src/pages/Practice.tsx', 'utf8');
    expect(src).toContain('fetchV2PracticeCatalog()');
    expect(src).not.toMatch(/supabase\s*\.from\('questions'\)/);
    expect(src).not.toMatch(/supabase\.from\('subjects'\)|supabase\.from\('subtopics'\)/);
  });

  it('0085 RPC: counts per subject only, definer, search_path "", authenticated only', () => {
    const m = readFileSync('supabase/migrations_v2/0085_practice_subject_counts_rpc.sql', 'utf8');
    expect(m).toMatch(/returns table\(subject_id uuid, question_count integer\)/);
    expect(m).not.toMatch(/subtopic_id|stem|options|correct_answer|explanation\b(?! )/);
    expect(m).toMatch(/security definer/);
    expect(m).toMatch(/set search_path to ''/);
    expect(m).toMatch(/revoke all on function public\.get_practice_subject_counts\(\) from public, anon;/);
    expect(m).toMatch(/grant execute on function public\.get_practice_subject_counts\(\) to authenticated;/);
  });
});
