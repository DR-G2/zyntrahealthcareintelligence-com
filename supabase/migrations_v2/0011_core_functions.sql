-- Phase 4 / 0011: narrow learning RPC contracts
create or replace function public.save_attempt(
  p_question_id uuid,
  p_session_id uuid,
  p_selected_answer text,
  p_is_correct boolean,
  p_time_taken_seconds integer default null,
  p_confidence_level smallint default null,
  p_answer_changes_count integer default 0,
  p_time_to_first_click integer default null,
  p_change_sequence jsonb default null,
  p_pause_events jsonb default null,
  p_time_of_day text default null,
  p_question_position integer default null,
  p_previous_question_correct boolean default null,
  p_question_version integer default null,
  p_app_version text default null,
  p_provenance jsonb default '{}'::jsonb
)
returns public.user_attempts
language plpgsql
security invoker
as $$
declare
  v_attempt public.user_attempts;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_confidence_level is not null and p_confidence_level not between 1 and 5 then
    raise exception 'confidence_level must be between 1 and 5';
  end if;

  insert into public.user_attempts (
    user_id, question_id, session_id, selected_answer, is_correct,
    time_taken_seconds, confidence_level, answer_changes_count,
    time_to_first_click, change_sequence, pause_events, time_of_day,
    question_position, previous_question_correct, question_version,
    app_version, provenance
  )
  values (
    auth.uid(), p_question_id, p_session_id, p_selected_answer, p_is_correct,
    p_time_taken_seconds, p_confidence_level, p_answer_changes_count,
    p_time_to_first_click, p_change_sequence, p_pause_events, p_time_of_day,
    p_question_position, p_previous_question_correct, p_question_version,
    p_app_version, coalesce(p_provenance,'{}'::jsonb)
  )
  returning * into v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) from public;
grant execute on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) to authenticated;
