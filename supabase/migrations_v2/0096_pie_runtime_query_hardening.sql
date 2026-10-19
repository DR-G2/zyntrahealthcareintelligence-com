-- 0096: PIE runtime query-path hardening and session-scoped decision-trace reads.
-- Additive only. Does not replace or alter the certified pie.decide / P12 inference path.

-- Candidate ranking repeatedly probes these deployed relations. Partial/composite indexes
-- avoid repeated heap scans during server-side session creation.
create index if not exists pie_question_quarantine_open_question_idx
  on pie.pie_question_quarantine(question_id)
  where status = 'open';

-- Some isolated verification replicas omit this legacy relation even though the
-- deployed selector references it. Add the supporting index when the table exists.
do $index$
begin
  if to_regclass('pie.lo_prerequisite') is not null then
    execute 'create index if not exists pie_lo_prerequisite_prerequisite_lo_idx on pie.lo_prerequisite(prerequisite_lo_id, lo_id)';
  end if;
end
$index$;

create index if not exists user_attempts_user_session_question_idx
  on public.user_attempts(user_id, session_id, question_id);

create index if not exists practice_session_questions_session_question_idx
  on public.practice_session_questions(session_id, question_id);

create index if not exists pie_decision_trace_user_session_created_idx
  on pie.decision_trace(user_id, session_id, created_at desc);

-- The prior all-history JSON aggregation made the client fetch every trace for a
-- candidate, although P21.2 only needs one session. Keep the existing RPC intact
-- for compatibility and expose an efficient, candidate-scoped session read.
create or replace function public.get_my_pie_decision_traces_for_session(p_session_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'session_id', d.session_id,
        'question_id', d.question_id,
        'decision_type', d.decision_type,
        'selected_action', d.selected_action,
        'rejected_actions', d.rejected_actions,
        'reason_codes', d.reason_codes,
        'policy_version', d.policy_version,
        'model_version', d.model_version,
        'confidence', d.confidence,
        'source', d.source,
        'created_at', d.created_at
      ) order by d.created_at desc
    ),
    '[]'::jsonb
  )
  from pie.decision_trace d
  where d.user_id = auth.uid()
    and d.session_id = p_session_id
    and exists (
      select 1 from public.practice_sessions ps
      where ps.id = p_session_id and ps.user_id = auth.uid()
    );
$function$;

revoke all on function public.get_my_pie_decision_traces_for_session(uuid) from public, anon;
grant execute on function public.get_my_pie_decision_traces_for_session(uuid) to authenticated;

-- Make the newly created RPC visible to PostgREST without waiting for a periodic cache refresh.
notify pgrst, 'reload schema';
