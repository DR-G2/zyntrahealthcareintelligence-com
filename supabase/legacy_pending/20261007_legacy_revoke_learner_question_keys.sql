-- =============================================================================================
-- LEGACY project (yudkfmgilucyhukfggij) ONLY. NOT APPLIED. Kept outside supabase/migrations so
-- no pipeline auto-applies it. Apply manually, by hand, in the SQL editor (role postgres).
--
-- WHEN: apply ONLY AFTER the P5 frontend is live (deployed and the old bundle is no longer served).
--   After this runs, any OLD build that selects a hidden column from public.questions gets
--   SQLSTATE 42501 "permission denied for table questions". That includes:
--     - select('*') on questions (old /questions bank browser): '*' expands to every column, so it
--       is rejected as soon as one column is hidden;
--     - old history views embedding questions(correct_answer, explanation, ...);
--     - the old MCP list-recent-attempts tool (questions(correct_answer)).
--   P5 reads keys only through admin-question-bank (service role) and the V2 history RPCs.
--   Edge functions use the service role and are unaffected.
--
-- WHY: repo history grants paid learners full-row SELECT on public.questions
--   20260303165352: policy "Questions are readable by authenticated users" (USING true)
--   20261002043440/043516: policy "Paid users and admins can read questions"
-- so a paid learner can read the key and every answer-revealing column of every row via REST.
--
-- WHAT: ALLOWLIST. authenticated may SELECT only the columns listed in _q_allow below; every
-- other column (including any column added later, or present on the live table but not in the
-- repo) is hidden. anon gets nothing (anon already lost SELECT in 20261002043440). RLS policies are
-- unchanged. Explicitly hidden (asserted never to be on the allowlist): see _q_must_hide.
--
-- FRONTEND AUDIT (P5 @ 95ae7e2, grep + transitive import closure, 2026-10-07):
--   Signed-out routes (src/App.tsx, no ProtectedRoute): / (Home), /check (Landing), /login,
--   /oauth/consent, /reset-password, /terms, /privacy, /amc-part-1-mcq, /blog, /blog/:slug,
--   /onboarding, * (NotFound), plus app-shell components (AuthProvider, VisitorTracker, SEO,
--   usePresence, useSiteSettings, ErrorBoundary, ProtectedRoute). Their import closure (46 files)
--   contains NO read of legacy public.questions (no .from('questions'), no questions(...) embed).
--   /check runs the diagnostic on V2 PIE, not the legacy get_diagnostic_question RPC.
--   Signed-in reads of legacy questions that remain, all within the allowlist:
--     src/pages/Practice.tsx           .from('questions').select('id, zyntra_id, category, subtopic, question_text, difficulty')
--     src/lib/mcp/tools/list-recent-attempts.ts  questions(zyntra_id, question_text, category, subtopic, difficulty)
--     src/lib/mcp/tools/get-subject-breakdown.ts questions(category)
--   Enforced by src/lib/pie/legacy-revoke.test.ts.
--
-- REHEARSAL: to dry-run on live, replace the final COMMIT with ROLLBACK.
-- ROLLBACK (if something unexpected breaks):  grant select on public.questions to authenticated;
-- =============================================================================================
--
-- PRECHECK BEGIN (READ-ONLY: SELECT only. Gus: run these first and send the output back.)
-- -- P1. every column, whether it stays learner-readable, and who can read it now
-- select a.attnum, a.attname,
--        a.attname = any (array['id','zyntra_id','question_text','options','category','subtopic',
--          'system_category','difficulty','difficulty_tier','question_type','clinical_vignette',
--          'avg_time_seconds','created_at']) as stays_readable,
--        has_column_privilege('anon', a.attrelid, a.attnum, 'select') as anon_reads_now,
--        has_column_privilege('authenticated', a.attrelid, a.attnum, 'select') as auth_reads_now
-- from pg_attribute a
-- where a.attrelid = 'public.questions'::regclass and a.attnum > 0 and not a.attisdropped
-- order by a.attnum;
-- -- P2. table-level grants to anon / authenticated / PUBLIC
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'questions' and grantee in ('anon', 'authenticated', 'PUBLIC')
-- order by 1, 2;
-- -- P3. explicit column-level grants (these survive a table-level revoke if not removed)
-- select a.attname, case when x.grantee = 0 then 'PUBLIC' else x.grantee::regrole::text end as grantee, x.privilege_type
-- from pg_attribute a cross join lateral aclexplode(a.attacl) x
-- where a.attrelid = 'public.questions'::regclass and a.attnum > 0 and a.attacl is not null
-- order by 1, 2, 3;
-- -- P4. RLS policies on questions
-- select policyname, roles, cmd, qual from pg_policies where schemaname = 'public' and tablename = 'questions';
-- -- P5. views / matviews reading questions (column grants do NOT protect owner-rights views)
-- select distinct c.oid::regclass as view_name, c.relkind,
--        coalesce(c.reloptions::text, '') as reloptions,
--        has_table_privilege('authenticated', c.oid, 'select') as auth_can_select
-- from pg_depend d join pg_rewrite r on r.oid = d.objid join pg_class c on c.oid = r.ev_class
-- where d.refobjid = 'public.questions'::regclass and c.oid <> 'public.questions'::regclass;
-- -- P6. functions mentioning questions: SECURITY DEFINER ones bypass column grants (check what
-- --     they return); INVOKER ones that touch hidden columns will start failing with 42501
-- select p.oid::regprocedure as fn, p.prosecdef as security_definer,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
--        p.prosrc ~* '(correct_answer|explanation|best_treatment|investigation|differential_diagnoses|key_takeaways|guideline_reference)' as touches_hidden
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.prosrc ~* '\mquestions\M'
-- order by 2, 1;
-- -- P7. size / ZQ items
-- select count(*) as rows, count(*) filter (where zyntra_id like 'ZQ-%') as zq_items from public.questions;
-- PRECHECK END
-- =============================================================================================

begin;
set local lock_timeout = '5s';

create temp table _q_allow (col text primary key) on commit drop;
insert into _q_allow values
  ('id'), ('zyntra_id'), ('question_text'), ('options'), ('category'), ('subtopic'),
  ('system_category'), ('difficulty'), ('difficulty_tier'), ('question_type'),
  ('clinical_vignette'), ('avg_time_seconds'), ('created_at');

-- Answer-revealing columns that must never be on the allowlist (post-checked by name as well).
create temp table _q_must_hide (col text primary key) on commit drop;
insert into _q_must_hide values
  ('correct_answer'), ('explanation'), ('incorrect_answer_explanations'), ('diagnosis_explanation'),
  ('best_treatment'), ('first_line_investigation'), ('gold_standard_investigation'),
  ('differential_diagnoses'), ('key_takeaways'), ('guideline_reference'), ('tags');

do $$
declare
  v_all text;
  v_grant text;
  v_missing text;
begin
  if exists (select 1 from _q_allow join _q_must_hide using (col)) then
    raise exception 'allowlist contains an answer-revealing column';
  end if;

  -- 1. strip EVERY select grant, table-level and column-level, from PUBLIC, anon and authenticated
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_all
  from pg_attribute where attrelid = 'public.questions'::regclass and attnum > 0 and not attisdropped;
  execute 'revoke select on public.questions from public, anon, authenticated';
  execute format('revoke select (%s) on public.questions from public, anon, authenticated', v_all);

  -- 2. grant the allowlist (only columns that exist) to authenticated; anon gets nothing
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_grant
  from pg_attribute a join _q_allow l on l.col = a.attname
  where a.attrelid = 'public.questions'::regclass and a.attnum > 0 and not a.attisdropped;
  select string_agg(col, ', ') into v_missing from _q_allow l
  where not exists (select 1 from pg_attribute a where a.attrelid = 'public.questions'::regclass
                    and a.attname = l.col and a.attnum > 0 and not a.attisdropped);
  if v_missing is not null then raise notice 'allowlisted columns not on live table (skipped): %', v_missing; end if;
  if v_grant is null then raise exception 'no allowlisted column exists on public.questions'; end if;
  execute format('grant select (%s) on public.questions to authenticated', v_grant);
end $$;

-- POSTCHECK BEGIN (aborts the transaction if anything answer-revealing is still readable)
do $$
declare
  r record;
  v_bad text[] := '{}';
  v_anon oid := 'anon'::regrole;
  v_auth oid := 'authenticated'::regrole;
begin
  -- a) every hidden column (= every column NOT on the allowlist, incl. drift) for anon AND authenticated
  for r in
    select a.attname from pg_attribute a
    where a.attrelid = 'public.questions'::regclass and a.attnum > 0 and not a.attisdropped
      and a.attname not in (select col from _q_allow)
  loop
    if has_column_privilege('anon', 'public.questions', r.attname, 'select') then v_bad := v_bad || ('anon reads ' || r.attname); end if;
    if has_column_privilege('authenticated', 'public.questions', r.attname, 'select') then v_bad := v_bad || ('authenticated reads ' || r.attname); end if;
  end loop;

  -- b) the named answer-revealing columns, by name (each must exist and be hidden from both roles)
  for r in select col from _q_must_hide loop
    if not exists (select 1 from pg_attribute a where a.attrelid = 'public.questions'::regclass
                   and a.attname = r.col and a.attnum > 0 and not a.attisdropped) then
      raise notice 'must-hide column % is not on this table', r.col;
    elsif has_column_privilege('anon', 'public.questions', r.col, 'select')
       or has_column_privilege('authenticated', 'public.questions', r.col, 'select') then
      v_bad := v_bad || ('must-hide still readable: ' || r.col);
    end if;
  end loop;

  -- c) no table-level SELECT left (table-level = every column) and anon reads no column at all
  if has_table_privilege('anon', 'public.questions', 'select') then v_bad := v_bad || 'anon has table-level select'::text; end if;
  if has_table_privilege('authenticated', 'public.questions', 'select') then v_bad := v_bad || 'authenticated has table-level select'::text; end if;
  if has_any_column_privilege('anon', 'public.questions', 'select') then v_bad := v_bad || 'anon can read some column'::text; end if;

  -- d) leftover explicit column-level grants on hidden columns (any privilege that implies reading:
  --    SELECT, plus any grant to PUBLIC/anon/authenticated at all on a hidden column is reported)
  for r in
    select a.attname, x.grantee, x.privilege_type
    from pg_attribute a cross join lateral aclexplode(a.attacl) x
    where a.attrelid = 'public.questions'::regclass and a.attnum > 0 and a.attacl is not null
      and a.attname not in (select col from _q_allow)
      and x.grantee in (0, v_anon, v_auth)
      and x.privilege_type = 'SELECT'
  loop
    v_bad := v_bad || format('leftover column grant %s on %s to %s', r.privilege_type, r.attname,
                             case when r.grantee = 0 then 'PUBLIC' else r.grantee::regrole::text end);
  end loop;

  -- e) the P5 app still works: every existing allowlisted column is readable by authenticated
  for r in select l.col from _q_allow l join pg_attribute a on a.attname = l.col
           where a.attrelid = 'public.questions'::regclass and a.attnum > 0 and not a.attisdropped loop
    if not has_column_privilege('authenticated', 'public.questions', r.col, 'select') then
      v_bad := v_bad || ('allowlisted column not readable: ' || r.col);
    end if;
  end loop;

  if cardinality(v_bad) > 0 then
    raise exception 'legacy key revoke post-check failed: %', array_to_string(v_bad, '; ');
  end if;
  raise notice 'legacy key revoke post-check passed';
end $$;
-- POSTCHECK END

commit;
