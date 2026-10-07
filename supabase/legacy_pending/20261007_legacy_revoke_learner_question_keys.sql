-- LEGACY project (yudkfmgilucyhukfggij) ONLY. NOT APPLIED. Kept outside supabase/migrations on
-- purpose so no pipeline auto-applies it. Apply manually at release, after the P5 frontend is live.
--
-- Why: repo history grants learners full-row SELECT on public.questions
--   20260303165352: policy "Questions are readable by authenticated users" (USING true)
--   20261002043440/043516: policy "Paid users and admins can read questions"
-- so any paid learner can read correct_answer / explanation for every row (incl. any ZQ items)
-- through the REST API. The P5 app no longer reads keys through the legacy client:
--   - /questions (+ /questions/mcq) -> admin-question-bank edge function (service role, server admin check)
--   - history views -> V2 get_my_attempt_history; Practice topic meta selects non-key columns only.
-- Edge functions use the service role and are unaffected.
--
-- Effect: anon/authenticated keep SELECT on every column EXCEPT the answer-revealing ones below.
-- RLS policies are unchanged.

begin;
do $$
declare
  v_hidden text[] := array['correct_answer', 'explanation', 'incorrect_answer_explanations'];
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'questions' and column_name <> all (v_hidden);

  execute 'revoke select on public.questions from anon, authenticated';
  execute format('grant select (%s) on public.questions to authenticated', v_cols);
end $$;

-- post-checks (abort the transaction if anything is still readable)
do $$ begin
  if has_column_privilege('authenticated', 'public.questions', 'correct_answer', 'select')
     or has_column_privilege('authenticated', 'public.questions', 'explanation', 'select')
     or has_column_privilege('anon', 'public.questions', 'correct_answer', 'select') then
    raise exception 'legacy key revoke did not take effect';
  end if;
end $$;
commit;

-- Read-only pre-check to run first (SELECT only):
-- select count(*) filter (where zyntra_id like 'ZQ-%') zq_items,
--        has_column_privilege('authenticated','public.questions','correct_answer','select') auth_key,
--        has_column_privilege('authenticated','public.questions','explanation','select') auth_expl
-- from public.questions;
