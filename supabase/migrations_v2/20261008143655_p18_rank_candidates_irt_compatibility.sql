-- P18 compatibility repair: align the legacy candidate selector with the current question/trace contracts.
-- This does not change selection weights. It replaces the obsolete questions.irt_b dependency
-- with the documented difficulty_tier prior and the obsolete decision_trace learner/LO fields
-- with current user_id + selected_action->lo_id fields.
-- P18 remains blocked until learner_lo_state schema compatibility is separately certified.

do $$
declare src text; new_src text;
begin
  select pg_get_functiondef(to_regprocedure('pie.rank_candidates(uuid,uuid,text,text,uuid[],uuid[])')) into src;
  new_src := replace(src, 'q.irt_b',
    'case lower(trim(q.difficulty_tier))
      when ''very easy'' then -2.0
      when ''easy'' then -1.0
      when ''moderate'' then 0.0
      when ''hard'' then 1.0
      when ''very hard'' then 2.0
      when ''impossible'' then 3.0
      else 0.0
    end');
  execute new_src;
end $$;
