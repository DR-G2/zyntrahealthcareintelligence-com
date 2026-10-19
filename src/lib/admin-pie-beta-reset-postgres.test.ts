// Disposable local-Postgres behavioural tests for the destructive reset RPCs.
// These tests never connect to Supabase. They skip if local PostgreSQL binaries are unavailable.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = ['/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin'].find((d) => existsSync(join(d, 'initdb')));
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations_v2/20261019110000_admin_pie_beta_reset.sql'), 'utf8');
const targetBlock = migration.match(/create or replace function public\._admin_beta_reset_targets\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/)?.[1] ?? '';
const targets = [...targetBlock.matchAll(/\(\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)]
  .map((m) => ({ order: Number(m[1]), schema: m[2], table: m[3], scope: m[4], mode: m[5] }));
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const SYN = uuid(100);
const REAL = uuid(200);
const ADMIN = uuid(300);
const SYN_SESSION = uuid(400);
const REAL_SESSION = uuid(401);
const SYN_ATTEMPT = uuid(500);
const REAL_ATTEMPT = uuid(501);
const special = new Set([
  'public.user_attempts', 'public.practice_sessions', 'public.practice_session_questions',
  'public.amc_adapter_evaluation', 'pie.pie_observation', 'pie.attempt_lo',
  'pie.pie_inference_run', 'pie.pie_candidate_state', 'pie.pie_state_uncertainty',
  'pie.pie_decision_candidate', 'pie.pie_decision', 'pie.pie_decision_outcome',
  'pie.pie_runtime_decision', 'pie.pie_dwig_candidate', 'pie.pie_dwig_evaluation',
  'pie.pie_dwig_selection', 'intelligence.candidate_interventions',
  'intelligence.intervention_outcomes', 'intelligence.behavior_events',
]);
let dir = '';
let port = 0;
const psql = (sql: string) => spawnSync(
  join(BIN!, 'psql'),
  ['-h', dir, '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q'],
  { input: sql, encoding: 'utf8' },
);
const runOrThrow = (sql: string) => {
  const result = psql(sql);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'psql failed');
  return result.stdout;
};

const baseSchema = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema pie;
create schema intelligence;
create function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('test.uid', true), '')::uuid
$fn$;
create function auth.jwt() returns jsonb language sql stable as $fn$
  select jsonb_build_object('email', current_setting('test.email', true))
$fn$;
create table auth.users (id uuid primary key, email text not null, email_confirmed_at timestamptz);
create table public.profiles (id uuid primary key, is_synthetic boolean not null);
insert into auth.users values
  ('${ADMIN}', 'gopalrock.naren@gmail.com', now()),
  ('${SYN}', 'synthetic@example.test', now()),
  ('${REAL}', 'real@example.test', now());
insert into public.profiles values ('${SYN}', true), ('${REAL}', false), ('${ADMIN}', false);

create table public.practice_sessions (id uuid primary key, user_id uuid not null);
create table public.user_attempts (
  id uuid primary key, user_id uuid not null,
  session_id uuid references public.practice_sessions(id) on delete set null
);
create table public.practice_session_questions (
  id uuid primary key, session_id uuid not null references public.practice_sessions(id) on delete cascade
);
create table pie.pie_inference_run (id uuid primary key, user_id uuid not null);
create table pie.pie_candidate_state (
  id uuid primary key, user_id uuid not null,
  source_inference_id uuid references pie.pie_inference_run(id) on delete set null
);
create table pie.pie_state_uncertainty (
  id uuid primary key, candidate_state_id uuid not null references pie.pie_candidate_state(id) on delete cascade
);
create table public.amc_adapter_evaluation (
  id uuid primary key, user_id uuid not null,
  candidate_state_id uuid references pie.pie_candidate_state(id) on delete set null
);
create table pie.pie_decision_candidate (id uuid primary key, user_id uuid not null);
create table pie.pie_decision (
  id uuid primary key,
  decision_candidate_id uuid not null references pie.pie_decision_candidate(id) on delete cascade
);
create table pie.pie_decision_outcome (
  id uuid primary key, decision_id uuid not null references pie.pie_decision(id) on delete cascade
);
create table pie.pie_runtime_decision (
  id uuid primary key, user_id uuid not null,
  decision_id uuid references pie.pie_decision(id) on delete set null
);
create table pie.pie_dwig_candidate (id uuid primary key, user_id uuid not null);
create table pie.pie_dwig_evaluation (
  id uuid primary key, dwig_candidate_id uuid not null references pie.pie_dwig_candidate(id) on delete cascade
);
create table pie.pie_dwig_selection (
  id uuid primary key, dwig_candidate_id uuid not null references pie.pie_dwig_candidate(id) on delete cascade
);
create table intelligence.candidate_interventions (id uuid primary key, user_id uuid not null);
create table intelligence.intervention_outcomes (
  id uuid primary key, candidate_intervention_id uuid not null references intelligence.candidate_interventions(id) on delete cascade
);
create table pie.pie_observation (
  id uuid primary key, user_id uuid not null,
  attempt_id uuid references public.user_attempts(id) on delete set null
);
create table pie.attempt_lo (
  id uuid primary key, attempt_id uuid not null references public.user_attempts(id) on delete cascade
);
create table intelligence.behavior_events (
  id uuid primary key, user_id uuid not null,
  session_id uuid references public.practice_sessions(id) on delete set null
);
`;

const genericTables = targets.filter((t) => !special.has(`${t.schema}.${t.table}`));
const genericDdl = genericTables.map((t) => {
  const column = t.scope === 'user_id' ? 'user_id' : ({
    attempt_user: 'attempt_id', session_user: 'session_id', intervention_user: 'candidate_intervention_id',
    decision_candidate: 'decision_candidate_id', decision_parent: 'decision_id',
    dwig_candidate: 'dwig_candidate_id', candidate_state: 'candidate_state_id',
  } as Record<string, string>)[t.scope];
  return `create table ${t.schema}.${t.table} (id uuid primary key, ${column} uuid not null);`;
}).join('\n');

const specialSeed = `
insert into public.practice_sessions values ('${SYN_SESSION}', '${SYN}'), ('${REAL_SESSION}', '${REAL}');
insert into public.user_attempts values ('${SYN_ATTEMPT}', '${SYN}', '${SYN_SESSION}'), ('${REAL_ATTEMPT}', '${REAL}', '${REAL_SESSION}');
insert into public.practice_session_questions values ('${uuid(600)}', '${SYN_SESSION}'), ('${uuid(601)}', '${REAL_SESSION}');
insert into pie.pie_inference_run values ('${uuid(1000)}', '${SYN}'), ('${uuid(1001)}', '${REAL}');
insert into pie.pie_candidate_state values ('${uuid(1100)}', '${SYN}', '${uuid(1000)}'), ('${uuid(1101)}', '${REAL}', '${uuid(1001)}');
insert into pie.pie_state_uncertainty values ('${uuid(1200)}', '${uuid(1100)}'), ('${uuid(1201)}', '${uuid(1101)}');
insert into public.amc_adapter_evaluation values ('${uuid(1300)}', '${SYN}', '${uuid(1100)}'), ('${uuid(1301)}', '${REAL}', '${uuid(1101)}');
insert into pie.pie_decision_candidate values ('${uuid(1400)}', '${SYN}'), ('${uuid(1401)}', '${REAL}');
insert into pie.pie_decision values ('${uuid(1500)}', '${uuid(1400)}'), ('${uuid(1501)}', '${uuid(1401)}');
insert into pie.pie_decision_outcome values ('${uuid(1600)}', '${uuid(1500)}'), ('${uuid(1601)}', '${uuid(1501)}');
insert into pie.pie_runtime_decision values ('${uuid(1700)}', '${SYN}', '${uuid(1500)}'), ('${uuid(1701)}', '${REAL}', '${uuid(1501)}');
insert into pie.pie_dwig_candidate values ('${uuid(1800)}', '${SYN}'), ('${uuid(1801)}', '${REAL}');
insert into pie.pie_dwig_evaluation values ('${uuid(1900)}', '${uuid(1800)}'), ('${uuid(1901)}', '${uuid(1801)}');
insert into pie.pie_dwig_selection values ('${uuid(2000)}', '${uuid(1800)}'), ('${uuid(2001)}', '${uuid(1801)}');
insert into intelligence.candidate_interventions values ('${uuid(2100)}', '${SYN}'), ('${uuid(2101)}', '${REAL}');
insert into intelligence.intervention_outcomes values ('${uuid(2200)}', '${uuid(2100)}'), ('${uuid(2201)}', '${uuid(2101)}');
insert into pie.pie_observation values ('${uuid(800)}', '${SYN}', '${SYN_ATTEMPT}'), ('${uuid(801)}', '${REAL}', '${REAL_ATTEMPT}');
insert into pie.attempt_lo values ('${uuid(700)}', '${SYN_ATTEMPT}'), ('${uuid(701)}', '${REAL_ATTEMPT}');
insert into intelligence.behavior_events values ('${uuid(900)}', '${SYN}', '${SYN_SESSION}'), ('${uuid(901)}', '${REAL}', '${REAL_SESSION}');
`;

const genericSeed = genericTables.map((t, i) => {
  const table = `${t.schema}.${t.table}`;
  const first = 3000 + i * 2;
  if (t.scope === 'user_id') {
    return `insert into ${table} (id, user_id) values ('${uuid(first)}', '${SYN}'), ('${uuid(first + 1)}', '${REAL}');`;
  }
  throw new Error(`Unexpected generic scope ${t.scope} for ${table}`);
}).join('\n');

const globalSeed = `
create table public.questions (id uuid primary key, stem text not null);
insert into public.questions values ('${uuid(8000)}', 'protected question');
create table pie.pie_question_state (id uuid primary key);
create table pie.pie_question_uncertainty (id uuid primary key);
create table pie.pie_runtime_gate (id uuid primary key);
create table pie.pie_legacy_compatibility (id uuid primary key);
create table pie.question_lo (id uuid primary key);
create table pie.learning_objective (id uuid primary key);
create table pie.pie_model_version (id uuid primary key);
insert into pie.pie_question_state values ('${uuid(8100)}');
insert into pie.pie_question_uncertainty values ('${uuid(8101)}');
insert into pie.pie_runtime_gate values ('${uuid(8102)}');
insert into pie.pie_legacy_compatibility values ('${uuid(8103)}');
insert into pie.question_lo values ('${uuid(8104)}');
insert into pie.learning_objective values ('${uuid(8105)}');
insert into pie.pie_model_version values ('${uuid(8106)}');
`;

const runResetAssertions = (mode: 'pie_only' | 'full_candidate') => `
begin;
do $test$
declare
  p jsonb;
  result jsonb;
  target record;
  predicate text;
  n bigint;
  mode_name text := '${mode}';
begin
  perform set_config('test.uid', '${ADMIN}', true);
  perform set_config('test.email', 'gopalrock.naren@gmail.com', true);
  p := public.admin_preview_pie_beta_reset(mode_name);
  if (p ->> 'mode') <> mode_name then raise exception 'preview returned wrong mode'; end if;
  if coalesce((p ->> 'total_rows')::bigint, 0) <= 0 then raise exception 'preview count was empty'; end if;
  result := public.admin_execute_pie_beta_reset(mode_name, p ->> 'confirmation_phrase', p ->> 'preview_token');
  if (result ->> 'success')::boolean is distinct from true then raise exception 'reset did not report success'; end if;

  for target in
    select * from public._admin_beta_reset_targets()
    where mode_name = 'full_candidate' or min_mode = 'pie_only'
    order by sort_order
  loop
    if to_regclass(format('%I.%I', target.schema_name, target.table_name)) is null then continue; end if;
    predicate := public._admin_beta_reset_predicate(target.scope_kind);
    execute format('select count(*) from %I.%I t where %s', target.schema_name, target.table_name, predicate) into n;
    if n <> 0 then raise exception 'synthetic rows remain in %.%: %', target.schema_name, target.table_name, n; end if;
    predicate := replace(predicate, 'is true', 'is false');
    execute format('select count(*) from %I.%I t where %s', target.schema_name, target.table_name, predicate) into n;
    if n <> 1 then raise exception 'real-candidate rows changed in %.%: expected 1, got %', target.schema_name, target.table_name, n; end if;
  end loop;

  if mode_name = 'pie_only' then
    if (select count(*) from public.user_attempts) <> 2 then raise exception 'PIE-only mode changed canonical attempts'; end if;
    if (select count(*) from public.practice_sessions) <> 2 then raise exception 'PIE-only mode changed practice sessions'; end if;
    if (select count(*) from public.practice_session_questions) <> 2 then raise exception 'PIE-only mode changed session membership'; end if;
  else
    if (select count(*) from public.user_attempts) <> 1 then raise exception 'full mode did not remove only synthetic attempts'; end if;
    if (select count(*) from public.practice_sessions) <> 1 then raise exception 'full mode did not remove only synthetic sessions'; end if;
    if (select count(*) from public.practice_session_questions) <> 1 then raise exception 'full mode did not remove only synthetic session membership'; end if;
  end if;

  if (select count(*) from public.questions) <> 1 then raise exception 'question bank was changed'; end if;
  if (select count(*) from public.profiles) <> 3 then raise exception 'candidate profiles were deleted'; end if;
  if (select count(*) from auth.users) <> 3 then raise exception 'auth accounts were deleted'; end if;
  if (select count(*) from pie.pie_question_state) <> 1
     or (select count(*) from pie.pie_question_uncertainty) <> 1
     or (select count(*) from pie.pie_runtime_gate) <> 1
     or (select count(*) from pie.pie_legacy_compatibility) <> 1
     or (select count(*) from pie.question_lo) <> 1
     or (select count(*) from pie.learning_objective) <> 1
     or (select count(*) from pie.pie_model_version) <> 1 then
    raise exception 'global question state or configuration was changed';
  end if;
end
$test$;
rollback;
`;

const crossOwnerGuardTest = `
begin;
update public.user_attempts set session_id = '${SYN_SESSION}' where id = '${REAL_ATTEMPT}';
do $test$
declare
  p jsonb;
  blocked boolean := false;
begin
  perform set_config('test.uid', '${ADMIN}', true);
  perform set_config('test.email', 'gopalrock.naren@gmail.com', true);
  p := public.admin_preview_pie_beta_reset('full_candidate');
  begin
    perform public.admin_execute_pie_beta_reset('full_candidate', p ->> 'confirmation_phrase', p ->> 'preview_token');
  exception when others then
    if sqlerrm not like 'Reset blocked: a non-synthetic attempt references a synthetic practice session.%' then
      raise;
    end if;
    blocked := true;
  end;
  if not blocked then raise exception 'cross-candidate session reference was not blocked'; end if;
  if (select count(*) from public.user_attempts) <> 2 then raise exception 'failed reset partially deleted attempts'; end if;
  if (select count(*) from pie.beta_reset_audit) <> 0 then raise exception 'failed reset wrote an audit success row'; end if;
end
$test$;
rollback;
`;

const cohortFingerprintTest = `
begin;
do $test$
declare
  p jsonb;
  blocked boolean := false;
begin
  perform set_config('test.uid', '${ADMIN}', true);
  perform set_config('test.email', 'gopalrock.naren@gmail.com', true);
  p := public.admin_preview_pie_beta_reset('pie_only');

  -- Swap the synthetic marker to a different candidate while keeping the
  -- per-table row counts identical. The preview token must still become stale.
  update public.profiles set is_synthetic = false where id = '${SYN}';
  update public.profiles set is_synthetic = true where id = '${REAL}';

  begin
    perform public.admin_execute_pie_beta_reset('pie_only', p ->> 'confirmation_phrase', p ->> 'preview_token');
  exception when others then
    if sqlerrm <> 'Data changed since preview. Run preview again.' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'candidate cohort change was not detected'; end if;
  if (select count(*) from pie.pie_observation) <> 2 then raise exception 'stale preview partially deleted PIE observations'; end if;
  if (select count(*) from public.user_attempts) <> 2 then raise exception 'stale preview partially deleted attempts'; end if;
  if (select count(*) from pie.beta_reset_audit) <> 0 then raise exception 'stale preview wrote a success audit row'; end if;
end
$test$;
rollback;
`;

const authorizationGuardTest = `
begin;
do $test$
declare
  blocked boolean := false;
begin
  perform set_config('test.uid', '${REAL}', true);
  perform set_config('test.email', 'candidate@example.com', true);
  begin
    perform public.admin_preview_pie_beta_reset('pie_only');
  exception when others then
    if sqlerrm <> 'Super-administrator access required' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'non-super-admin preview was not blocked'; end if;

  perform set_config('test.uid', '${ADMIN}', true);
  perform set_config('test.email', 'gopalrock.naren@gmail.com', true);
  blocked := false;
  begin
    perform public.admin_preview_pie_beta_reset(null);
  exception when others then
    if sqlerrm <> 'Unsupported reset mode' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'NULL reset mode was not blocked'; end if;
  if (select count(*) from public.user_attempts) <> 2 then raise exception 'authorization guard changed attempts'; end if;
  if (select count(*) from pie.beta_reset_audit) <> 0 then raise exception 'blocked preview/reset wrote an audit row'; end if;
end
$test$;
rollback;
`;

describe.skipIf(!BIN)('PIE beta reset RPCs on a disposable local PostgreSQL instance', () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'zyntra-pie-reset-'));
    port = 24000 + Math.floor(Math.random() * 12000);
    execFileSync(join(BIN!, 'initdb'), ['-D', join(dir, 'data'), '-U', 'postgres', '--auth=trust', '-E', 'UTF8'], { stdio: 'ignore' });
    execFileSync(join(BIN!, 'pg_ctl'), ['-D', join(dir, 'data'), '-o', `-k ${dir} -p ${port} -c listen_addresses=''`, '-w', 'start', '-l', join(dir, 'log')], { stdio: 'ignore' });
    runOrThrow(baseSchema + '\n' + genericDdl + '\n' + globalSeed + '\n' + specialSeed + '\n' + genericSeed);
    runOrThrow(migration);
  }, 60000);

  afterAll(() => {
    if (dir) {
      spawnSync(join(BIN!, 'pg_ctl'), ['-D', join(dir, 'data'), '-m', 'immediate', 'stop']);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PIE-only mode clears synthetic PIE evidence but preserves canonical attempts, sessions, and global configuration', () => {
    expect(() => runOrThrow(runResetAssertions('pie_only'))).not.toThrow();
  });

  it('full-candidate mode clears synthetic attempts and sessions while preserving real candidate data', () => {
    expect(() => runOrThrow(runResetAssertions('full_candidate'))).not.toThrow();
  });

  it('rejects stale previews when the synthetic candidate cohort changes without changing counts', () => {
    expect(() => runOrThrow(cohortFingerprintTest)).not.toThrow();
  });

  it('rejects non-super-admin access and NULL reset modes', () => {
    expect(() => runOrThrow(authorizationGuardTest)).not.toThrow();
  });

  it('aborts atomically if deleting a synthetic session could mutate a real candidate attempt', () => {
    expect(() => runOrThrow(crossOwnerGuardTest)).not.toThrow();
  });
});
