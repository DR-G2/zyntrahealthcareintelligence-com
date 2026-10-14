import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const m = readFileSync('supabase/migrations_v2/0084_pie_new_content_reserve.sql', 'utf8');

describe('0084 PIE new-content reservation (static contract)', () => {
  it('replaces only pie.decide, keeping SECURITY DEFINER and search_path ""', () => {
    expect(m.match(/create or replace function/gi)).toHaveLength(1);
    expect(m).toMatch(/create or replace function pie\.decide\(/);
    expect(m).toMatch(/security definer/i);
    expect(m).toMatch(/set search_path to ''/i);
  });
  it('grants EXECUTE to service_role only (no public, anon or authenticated)', () => {
    expect(m).toMatch(/revoke all on function pie\.decide\([^)]*\) from public, anon, authenticated;/);
    expect(m).toMatch(/grant execute on function pie\.decide\([^)]*\) to service_role;/);
    expect(m).not.toMatch(/grant execute[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i);
  });
  it('reserves ceil(0.2 * target) after the subject-cap exclusion and traces it', () => {
    expect(m).toMatch(/v_reserve := ceil\(0\.2 \* v_target\)::int/);
    expect(m.indexOf("reject_reason = 'subject_cap'")).toBeLessThan(m.indexOf('0084 new-content reservation (after'));
    expect(m).toMatch(/'new_content_reserve', v_res_state/);
    expect(m).toMatch(/array\['new_content_reserved'\]/);
    expect(m).toMatch(/when v_fallback then 'cap_fallback_active'/);
  });
  it('keeps the 0083 subject cap and null guard', () => {
    expect(m).toMatch(/v_cap := ceil\(0\.4 \* greatest\(v_target, v_served \+ 1\)\)::int/);
    expect(m).toMatch(/where subject_id is not null group by 1/);
  });
});
