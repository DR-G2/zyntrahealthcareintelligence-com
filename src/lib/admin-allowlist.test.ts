import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { resolveAdminRow } from '../../supabase/functions/_shared/admin-allowlist';

const T = async () => ({ data: true, error: null });
const F = async () => ({ data: false, error: null });

describe('resolveAdminRow (is_admin / is_super_admin helper, role from DB)', () => {
  it('allow: is_admin true, is_super_admin false -> admin (lower-cased email)', async () => {
    expect(await resolveAdminRow(T, F, ' Admin@Example.com ')).toEqual({ data: { email: 'admin@example.com', role: 'admin' }, error: null });
  });
  it('allow: is_super_admin true -> super_admin', async () => {
    expect((await resolveAdminRow(T, T, 'boss@example.com')).data?.role).toBe('super_admin');
  });
  it('deny: is_admin false / null / non-boolean truthy (even if is_super_admin true)', async () => {
    for (const data of [false, null, 'true', 1, {}]) {
      expect((await resolveAdminRow(async () => ({ data, error: null }), T, 'a@example.com')).data).toBeNull();
    }
  });
  it('deny: missing/invalid email never calls rpc', async () => {
    let called = false;
    const r = await resolveAdminRow(async () => { called = true; return { data: true, error: null }; }, T, '');
    expect(r.data).toBeNull();
    expect(called).toBe(false);
  });
  it('error -> deny (is_admin error object, even with data true)', async () => {
    const r = await resolveAdminRow(async () => ({ data: true, error: { message: 'boom' } }), T, 'a@example.com');
    expect(r.data).toBeNull();
    expect(r.error).toEqual({ message: 'boom' });
  });
  it('error -> deny (is_admin throws)', async () => {
    const r = await resolveAdminRow(async () => { throw new Error('network'); }, T, 'a@example.com');
    expect(r.data).toBeNull();
    expect(String(r.error)).toContain('network');
  });
  it('is_super_admin error/throw/non-true never escalates (stays admin)', async () => {
    expect((await resolveAdminRow(T, async () => ({ data: true, error: { message: 'x' } }), 'a@example.com')).data?.role).toBe('admin');
    expect((await resolveAdminRow(T, async () => { throw new Error('x'); }, 'a@example.com')).data?.role).toBe('admin');
    expect((await resolveAdminRow(T, async () => ({ data: 'true', error: null }), 'a@example.com')).data?.role).toBe('admin');
  });
  it('no SUPER_ADMIN_EMAILS env dependency anywhere in supabase/functions', () => {
    const src = ['_shared/admin-allowlist.ts', '_shared/admin-rpc.ts'].map((f) => readFileSync(resolve(process.cwd(), 'supabase/functions', f), 'utf8')).join('\n');
    expect(src).not.toContain('SUPER_ADMIN_EMAILS');
    expect(src).toContain('"is_super_admin"');
  });
});

describe('allowlist role migration (20261014071000)', () => {
  const m = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261014071000_admin_allowlist_role.sql'), 'utf8');
  it('adds role NOT NULL DEFAULT admin with CHECK, never promotes anyone', () => {
    expect(m).toContain("add column if not exists role text not null default 'admin'");
    expect(m).toContain("CHECK (role IN ('admin', 'super_admin'))");
    expect(m).not.toMatch(/^\s*update\s+pie\.security_admin_allowlist[^\n]*super_admin/im);
  });
  it('is_super_admin: DEFINER, search_path empty, same strict checks + role, grants', () => {
    expect(m).toMatch(/FUNCTION public\.is_super_admin\(\)\nRETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''/);
    expect(m).toContain("a.enabled = true AND a.user_id = u.id AND lower(a.email) = v_email AND a.role = 'super_admin'");
    expect(m).toContain('NOT coalesce(public.is_admin(NULL), false)');
    expect(m).toContain('u.email_confirmed_at IS NOT NULL');
    expect(m).toContain('REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated');
    expect(m).toContain('GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated');
  });
  it('self-check uses acldefault on NULL proacl and asserts search_path', () => {
    expect(m).toContain("aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))");
    expect(m).toContain(`proconfig @> ARRAY['search_path=""']::text[]`);
    expect(m).toContain("a.grantee = 'anon'::regrole");
    expect(m).toContain('attnotnull');
  });
  it('allowlist: explicit table+column revokes from client roles, asserted in self-check; CHECK enforced', () => {
    expect(m).toContain('REVOKE ALL ON TABLE pie.security_admin_allowlist FROM PUBLIC, anon, authenticated');
    expect(m).toContain("REVOKE ALL (%I) ON TABLE pie.security_admin_allowlist FROM PUBLIC, anon, authenticated");
    expect(m).toContain("has_column_privilege(r, 'pie.security_admin_allowlist', 'role', 'UPDATE')");
    expect(m).toContain("has_column_privilege(r, 'pie.security_admin_allowlist', 'role', 'INSERT')");
    expect(m).toContain("has_table_privilege(r, 'pie.security_admin_allowlist', p)");
    expect(m).toContain("acldefault('r', c.relowner)");
    expect(m).toContain('convalidated');
    expect(m).toContain("SET role = 'root'");
    expect(m).toContain('EXCEPTION WHEN check_violation THEN');
  });
});

describe('no edge function reads public.admin_roles any more', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
  it('no .from("admin_roles") in supabase/functions', () => {
    // Exempt only the P2c destructive-action guard on command.admin_roles (explicit .schema("command")): it refuses, never grants.
    const hits = walk(resolve(process.cwd(), 'supabase/functions')).filter((f) => {
      const src = readFileSync(f, 'utf8');
      return [...src.matchAll(/from\(\s*["']admin_roles["']\s*\)/g)].some((m) => !src.slice(Math.max(0, m.index! - 30), m.index).includes('schema("command")'));
    });
    expect(hits).toEqual([]);
  });
  it('no hard-coded admin email LIST is used for authorization in supabase/functions', () => {
    const files = walk(resolve(process.cwd(), 'supabase/functions'));
    const lists = files.filter((f) => /ADMIN_EMAILS\s*=\s*\[/.test(readFileSync(f, 'utf8')));
    expect(lists).toEqual([]);
    const inc = files.filter((f) => /ADMIN_EMAILS?\.includes\(/.test(readFileSync(f, 'utf8')));
    expect(inc).toEqual([]);
    // Remaining SUPER_ADMIN_EMAIL constants only PROTECT the super admin as a TARGET (never grant access).
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/[^\n]*SUPER_ADMIN_EMAIL[^\n]*/g)) {
        if (/^\s*(\*|\/\/|const SUPER_ADMIN_EMAIL =)/.test(m[0])) continue;
        expect(m[0], f).toMatch(/(targetEmail|email) === SUPER_ADMIN_EMAIL/);
      }
    }
  });
  it('admin-audit-quality and v2-ai-lab use the is_admin() path', () => {
    expect(readFileSync(resolve(process.cwd(), 'supabase/functions/admin-audit-quality/index.ts'), 'utf8')).toContain('await adminRoleRow(req, claims.claims.email)');
    const v2 = readFileSync(resolve(process.cwd(), 'supabase/functions/v2-ai-lab/_shared/auth.ts'), 'utf8');
    expect(v2).toContain('callerRpc(authHeader, "is_admin")');
    expect(v2).toContain('isAdmin(caller.email, req.headers.get("Authorization"))');
  });
  it('every super_admin edge function gates on the DB role from adminRoleRow (caller JWT)', () => {
    for (const f of ['admin-cleanup-stations', 'admin-cleanup-questions', 'admin-reset-test-user', 'admin-seed-synthetic-users', 'admin-question-bank', 'admin-user-actions']) {
      const src = readFileSync(resolve(process.cwd(), `supabase/functions/${f}/index.ts`), 'utf8');
      expect(src, f).toMatch(/await adminRoleRow\(req, /);
      expect(src, f).toMatch(/super_admin|canReadQuestionBank\(role/);
    }
    const rpc = readFileSync(resolve(process.cwd(), 'supabase/functions/_shared/admin-rpc.ts'), 'utf8');
    expect(rpc).toContain('callerRpc(h, "is_super_admin")');
    expect(rpc).toContain('global: { headers: { Authorization: authHeader } }');
    expect(rpc).toContain('Deno.env.get("SUPABASE_ANON_KEY")');
    expect(rpc).not.toContain('SERVICE_ROLE');
  });
  it('Questions page gates on rpc("is_admin")', () => {
    const q = readFileSync(resolve(process.cwd(), 'src/pages/Questions.tsx'), 'utf8');
    expect(q).toContain("supabase.rpc('is_super_admin')");
    expect(q).toContain('setIsSuperAdmin(!error && data === true)');
    expect(q).toContain('() => { if (!cancelled) setIsSuperAdmin(false); }');
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
