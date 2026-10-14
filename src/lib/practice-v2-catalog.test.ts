import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { countV2Catalog, fetchV2PracticeCatalog } from './practice-v2-catalog';

function fakeClient(tables: Record<string, unknown[]>, calls: Array<{ table: string; cols: string; filters: string[] }>) {
  return {
    from(table: string) {
      const call = { table, cols: '', filters: [] as string[] };
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

describe('V2 practice catalog', () => {
  it('reads only ids/names from V2 active rows and counts by id', async () => {
    const calls: any[] = [];
    const cat = await fetchV2PracticeCatalog(fakeClient({
      subjects: [{ id: 's1', name: 'Population Health & Ethics', sort_order: 9 }, { id: 's2', name: 'Anatomy', sort_order: 1 }],
      subtopics: [{ id: 't1', name: 'Screening', subject_id: 's1', sort_order: 1 }],
      questions: [{ id: 'q1', subject_id: 's1', subtopic_id: 't1' }, { id: 'q2', subject_id: 's1', subtopic_id: null }, { id: 'q3', subject_id: 's2', subtopic_id: null }],
    }, calls));
    expect(cat.subjects[0]).toEqual({ id: 's1', name: 'Population Health & Ethics', display_order: 9 });
    const { categoryCounts, subtopicCounts } = countV2Catalog(cat);
    expect(categoryCounts).toEqual({ 'Population Health & Ethics': 2, Anatomy: 1 });
    expect(subtopicCounts).toEqual({ Screening: 1 });
    const qcall = calls.find((c) => c.table === 'questions');
    expect(qcall.cols).toBe('id, subject_id, subtopic_id');
    expect(qcall.filters).toContain('status=active');
    for (const c of calls) expect(c.cols).not.toMatch(/explanation|stem|correct_answer|options/);
  });

  it('Practice setup no longer reads questions from the legacy client', () => {
    const src = readFileSync('src/pages/Practice.tsx', 'utf8');
    expect(src).toContain('fetchV2PracticeCatalog()');
    expect(src).not.toMatch(/supabase\s*\.from\('questions'\)/);
    expect(src).not.toMatch(/supabase\.from\('subjects'\)|supabase\.from\('subtopics'\)/);
  });
});
