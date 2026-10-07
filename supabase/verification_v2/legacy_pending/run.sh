#!/usr/bin/env bash
# Scratch-DB verification of supabase/legacy_pending/*.sql (NEVER points at a live project).
# Usage: PGHOST=/tmp PGPORT=55434 PGUSER=supabase_admin bash supabase/verification_v2/legacy_pending/run.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
REVOKE="$ROOT/supabase/legacy_pending/20261007_legacy_revoke_learner_question_keys.sql"
LOWER="$ROOT/supabase/legacy_pending/20261007_legacy_admin_roles_email_lowercase.sql"
DB=legacy_pending_scratch
case "${PGHOST:-}" in /tmp|/var/run/postgresql|localhost|127.0.0.1) ;; *) echo "refusing: PGHOST must be local"; exit 2;; esac
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
P() { PGOPTIONS="-c client_min_messages=notice" psql -X -q -v ON_ERROR_STOP=1 -d $DB "$@"; }
T() { P "$@" 2>&1 || true; }   # expected-to-fail statements: capture output, ignore exit status
fail() { echo "FAIL: $*"; exit 1; }

fixture() {
P <<'SQL'
set client_min_messages = warning;
drop schema if exists auth cascade; create schema auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;
drop table if exists public.questions cascade;
create table public.questions (
  id uuid primary key default gen_random_uuid(), question_text text not null, options jsonb not null,
  correct_answer text not null, explanation text, category text not null, difficulty text not null default 'medium',
  tags text[], avg_time_seconds int default 90, created_at timestamptz not null default now(),
  diagnosis_explanation text, first_line_investigation text, gold_standard_investigation text, best_treatment text,
  differential_diagnoses jsonb default '[]', incorrect_answer_explanations jsonb default '{}', key_takeaways text[],
  clinical_vignette boolean default true, difficulty_tier int, zyntra_id text unique, subtopic text,
  system_category text, guideline_reference text, question_type text not null default 'mcq',
  answer_rationale_live_only text            -- drift: exists on "live" but not in the repo
);
alter table public.questions enable row level security;
create policy q_read on public.questions for select to authenticated using (true);
insert into public.questions (question_text, options, correct_answer, explanation, category, zyntra_id, best_treatment, answer_rationale_live_only)
values ('A 54-year-old man presents with crushing chest pain radiating to the left arm for 40 minutes.', '["A","B","C","D","E"]', 'C', 'because', 'Cardiology', 'ZQ-000001', 'PCI', 'C is right');
-- Supabase-style defaults + LEFTOVERS the script must clean up
grant select on public.questions to anon, authenticated;
grant select (correct_answer, key_takeaways) on public.questions to authenticated;
grant select (tags) on public.questions to public;
grant select (explanation) on public.questions to anon;
SQL
}

as_role() { P -At -c "set role $1; set request.jwt.claims = '{\"sub\":\"00000000-0000-0000-0000-000000000001\",\"role\":\"$1\"}'; $2" 2>&1 || true; }

echo "== revoke: precheck block is valid read-only SQL"
fixture
sed -n '/^-- PRECHECK BEGIN/,/^-- PRECHECK END/p' "$REVOKE" | sed -e '1d;$d' -e 's/^-- \{0,1\}//' > /tmp/legacy_precheck.sql
grep -Eiq '^\s*(insert|update|delete|alter|grant|revoke|drop|create|truncate)\b' /tmp/legacy_precheck.sql && fail "precheck is not read-only"
P -c "begin read only" -f /tmp/legacy_precheck.sql -c "rollback" > /tmp/legacy_precheck.out || fail "precheck errored"
grep -q "answer_rationale_live_only" /tmp/legacy_precheck.out || fail "precheck did not list drift column"

echo "== revoke: applies over leftovers and passes its own post-check"
P -f "$REVOKE" 2>&1 | grep -q "post-check passed" || fail "revoke did not pass"
[ "$(as_role authenticated 'select question_text from public.questions')" != "" ] || fail "stem unreadable"
as_role authenticated "select id, zyntra_id, category, subtopic, question_text, difficulty, options, system_category, difficulty_tier, question_type, clinical_vignette, avg_time_seconds, created_at from public.questions" | grep -q "ZQ-000001" || fail "allowlist not readable"
for c in correct_answer explanation incorrect_answer_explanations diagnosis_explanation best_treatment first_line_investigation gold_standard_investigation differential_diagnoses key_takeaways guideline_reference tags answer_rationale_live_only; do
  as_role authenticated "select $c from public.questions" | grep -q "permission denied" || fail "authenticated reads $c"
  as_role anon "select $c from public.questions" | grep -q "permission denied" || fail "anon reads $c"
done
as_role authenticated "select * from public.questions" | grep -q "permission denied" || fail "select * should be 42501 (old builds)"
as_role anon "select id from public.questions" | grep -q "permission denied" || fail "anon reads id"
as_role authenticated "select id from public.questions where correct_answer = 'C'" | grep -q "permission denied" || fail "filter on key allowed"
[ "$(P -At -c "select count(*) from pg_attribute a cross join lateral aclexplode(a.attacl) x where a.attrelid='public.questions'::regclass and a.attname not in ('id','zyntra_id','question_text','options','category','subtopic','system_category','difficulty','difficulty_tier','question_type','clinical_vignette','avg_time_seconds','created_at') and x.grantee in (0,'anon'::regrole,'authenticated'::regrole)")" = 0 ] || fail "leftover column grants"
P -f "$REVOKE" 2>&1 | grep -q "post-check passed" || fail "not idempotent"

echo "== revoke: post-check catches each class of leftover (transaction rolls back)"
for inject in \
  "grant select (correct_answer) on public.questions to authenticated;" \
  "grant select (answer_rationale_live_only) on public.questions to authenticated;" \
  "grant select (best_treatment) on public.questions to anon;" \
  "grant select (tags) on public.questions to public;" \
  "grant select on public.questions to anon;" \
  "grant select (id) on public.questions to anon;" \
  "revoke select (question_text) on public.questions from authenticated;" ; do
  fixture
  awk -v inj="$inject" '/^-- POSTCHECK BEGIN/{print inj} {print}' "$REVOKE" > /tmp/legacy_revoke_inj.sql
  out=$(P -f /tmp/legacy_revoke_inj.sql 2>&1 || true)
  echo "$out" | grep -q "post-check failed" || fail "post-check missed: $inject"
  # rolled back: fixture's original full-row grant is still there
  as_role authenticated "select correct_answer from public.questions" | grep -q "^C$" || fail "did not roll back: $inject"
done

echo "== admin_roles lowercase"
P <<'SQL'
create table public.admin_roles (id uuid primary key default gen_random_uuid(), email text not null unique,
  role text not null check (role in ('super_admin','admin')), created_at timestamptz not null default now());
alter table public.admin_roles enable row level security;
insert into public.admin_roles(email, role) values ('Gopal.Admin@Example.com ', 'super_admin'), ('ops@example.com', 'admin');
create table public.payments (user_id uuid, status text);
create table public.manual_overrides (user_id uuid, expires_at timestamptz);
create or replace function public.is_admin(_email text) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.admin_roles where email = _email) $$;
SQL
sed -n '/^-- PRECHECK BEGIN/,/^-- PRECHECK END/p' "$LOWER" | sed -e '1d;$d' -e 's/^-- \{0,1\}//' > /tmp/legacy_lower_precheck.sql
P -c "begin read only" -f /tmp/legacy_lower_precheck.sql -c "rollback" > /tmp/legacy_lower_precheck.out || fail "lowercase precheck errored"
grep -q "gopal.admin@example.com" /tmp/legacy_lower_precheck.out || fail "lowercase precheck"
P -f "$LOWER" 2>&1 | grep -q "admin_roles lowercase check passed" || fail "lowercase migration"
[ "$(P -At -c "select email from public.admin_roles where role='super_admin'")" = "gopal.admin@example.com" ] || fail "not normalised"
T -c "insert into public.admin_roles(email, role) values ('Mixed@Example.com','admin')" | grep -q "admin_roles_email_lowercase" || fail "constraint missing"
[ "$(P -At -c "select public.is_admin('GOPAL.ADMIN@example.com ')")" = t ] || fail "is_admin not case-insensitive"
[ "$(P -At -c "set request.jwt.claims='{\"email\":\"Ops@Example.COM\",\"sub\":\"00000000-0000-0000-0000-000000000002\"}'; select public.current_user_can_read_questions()")" = t ] || fail "can_read not case-insensitive"
P -f "$LOWER" 2>&1 | grep -q "admin_roles lowercase check passed" || fail "lowercase not idempotent"
# duplicate-under-lowercase aborts without changing anything
P -c "alter table public.admin_roles drop constraint admin_roles_email_lowercase" -c "insert into public.admin_roles(email, role) values ('OPS@example.com','admin')"
T -f "$LOWER" | grep -q "duplicate" || fail "duplicate not detected"
[ "$(P -At -c "select count(*) from public.admin_roles where email='OPS@example.com'")" = 1 ] || fail "duplicate run changed data"

psql -q -d postgres -c "drop database $DB"
echo "legacy_pending: ALL PASS"
