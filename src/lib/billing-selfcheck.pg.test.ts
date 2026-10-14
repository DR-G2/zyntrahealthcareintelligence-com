// Behavioural check of the 20261014051000 grant self-check against a throwaway local Postgres.
// Skipped automatically when no local Postgres binaries are available (e.g. CI without postgres).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = ['/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin'].find((d) => existsSync(join(d, 'initdb')));
const migDir = resolve(process.cwd(), 'supabase/migrations');
const mig = readFileSync(join(migDir, readdirSync(migDir).find((n) => n.startsWith('20261014051000'))!), 'utf8');
const chk = mig.slice(mig.indexOf('DO $chk$'), mig.indexOf('$chk$;', mig.indexOf('DO $chk$')) + 6);

const STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as 'select null::uuid';
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create table public.payments (id uuid primary key default gen_random_uuid(), user_id uuid, status text, tier text,
  trial_end_at timestamptz, current_period_end timestamptz, cancel_at_period_end boolean not null default false);
create table public.manual_overrides (user_id uuid, expires_at timestamptz);
`;

let dir = '';
let port = 0;
const psql = (sql: string) =>
  spawnSync(join(BIN!, 'psql'), ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q'], { input: sql, encoding: 'utf8' });

describe.skipIf(!BIN)('051000 self-check (behavioural, local Postgres)', () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'pg87-'));
    port = 20000 + Math.floor(Math.random() * 20000);
    execFileSync(join(BIN!, 'initdb'), ['-D', join(dir, 'data'), '-U', 'postgres', '--auth=trust', '-E', 'UTF8'], { stdio: 'ignore' });
    execFileSync(join(BIN!, 'pg_ctl'), ['-D', join(dir, 'data'), '-o', `-k ${dir} -p ${port} -c listen_addresses=''`, '-w', 'start', '-l', join(dir, 'log')], { stdio: 'ignore' });
    const r = psql(STUB);
    if (r.status !== 0) throw new Error(r.stderr);
  }, 60000);
  afterAll(() => {
    if (dir) { spawnSync(join(BIN!, 'pg_ctl'), ['-D', join(dir, 'data'), '-m', 'immediate', 'stop']); rmSync(dir, { recursive: true, force: true }); }
  });

  it('the migration applies cleanly and its own self-check passes', () => {
    const r = psql(mig);
    expect(r.stderr).not.toMatch(/ERROR/);
    expect(r.status).toBe(0);
  });
  it('NULL proacl (default PUBLIC EXECUTE) is caught: fresh is_admin without revoke -> abort', () => {
    const r = psql(`
      DROP FUNCTION public.current_user_can_read_questions();
      DROP FUNCTION public.is_admin(text);
      CREATE FUNCTION public.is_admin(_email text DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS 'select false';
      SELECT 'proacl_null=' || (proacl IS NULL) FROM pg_proc WHERE oid = 'public.is_admin(text)'::regprocedure;
      ${chk}`);
    expect(r.stdout).toContain('proacl_null=true');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/not as required|anon/);
  });
  it('explicit PUBLIC grant on payment_row_entitled is caught', () => {
    expect(psql(mig).status).toBe(0); // restore
    const r = psql(`GRANT EXECUTE ON FUNCTION public.payment_row_entitled(public.payments) TO PUBLIC; ${chk}`);
    expect(r.status).not.toBe(0);
  });
});
