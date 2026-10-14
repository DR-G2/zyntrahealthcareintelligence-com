import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { resolveAdminRow, superAdminEmails } from '../../supabase/functions/_shared/admin-allowlist';

const SUPERS = superAdminEmails(' Boss@Example.com , not-an-email ,');

describe('resolveAdminRow (is_admin allowlist helper)', () => {
  it('allow: is_admin() true -> admin row (lower-cased email)', async () => {
    const r = await resolveAdminRow(async () => ({ data: true, error: null }), ' Admin@Example.com ', SUPERS);
    expect(r).toEqual({ data: { email: 'admin@example.com', role: 'admin' }, error: null });
  });
  it('allow: super_admin only when email is in SUPER_ADMIN_EMAILS', async () => {
    const r = await resolveAdminRow(async () => ({ data: true, error: null }), 'boss@example.com', SUPERS);
    expect(r.data?.role).toBe('super_admin');
    const none = await resolveAdminRow(async () => ({ data: true, error: null }), 'boss@example.com', superAdminEmails(undefined));
    expect(none.data?.role).toBe('admin');
  });
  it('deny: is_admin() false / null / non-boolean truthy', async () => {
    for (const data of [false, null, 'true', 1, {}]) {
      expect((await resolveAdminRow(async () => ({ data, error: null }), 'a@example.com', SUPERS)).data).toBeNull();
    }
  });
  it('deny: missing/invalid email never calls rpc', async () => {
    let called = false;
    const r = await resolveAdminRow(async () => { called = true; return { data: true, error: null }; }, '', SUPERS);
    expect(r.data).toBeNull();
    expect(called).toBe(false);
  });
  it('error -> deny (rpc error object, even with data true)', async () => {
    const r = await resolveAdminRow(async () => ({ data: true, error: { message: 'boom' } }), 'a@example.com', SUPERS);
    expect(r.data).toBeNull();
    expect(r.error).toEqual({ message: 'boom' });
  });
  it('error -> deny (rpc throws)', async () => {
    const r = await resolveAdminRow(async () => { throw new Error('network'); }, 'a@example.com', SUPERS);
    expect(r.data).toBeNull();
    expect(String(r.error)).toContain('network');
  });
  it('superAdminEmails ignores junk', () => {
    expect(SUPERS).toEqual(['boss@example.com']);
  });
});

describe('no edge function reads public.admin_roles any more', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
  it('no .from("admin_roles") in supabase/functions', () => {
    const hits = walk(resolve(process.cwd(), 'supabase/functions')).filter((f) => /from\(\s*["']admin_roles["']\s*\)/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
  it('Questions page gates on rpc("is_admin")', () => {
    expect(readFileSync(resolve(process.cwd(), 'src/pages/Questions.tsx'), 'utf8')).toContain("supabase.rpc('is_admin'");
  });
});

describe('allowlist user_id NOT NULL migration', () => {
  const s = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261014070000_admin_allowlist_user_id_not_null.sql'), 'utf8');
  it('prechecks NULL rows before SET NOT NULL and self-checks attnotnull', () => {
    expect(s.indexOf('WHERE user_id IS NULL')).toBeGreaterThan(0);
    expect(s.indexOf('WHERE user_id IS NULL')).toBeLessThan(s.indexOf('alter column user_id set not null'));
    expect(s).toContain("RAISE EXCEPTION 'pie.security_admin_allowlist has % row(s) with NULL user_id");
    expect(s).toContain('attnotnull');
  });
});
