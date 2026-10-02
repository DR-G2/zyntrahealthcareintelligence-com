CREATE OR REPLACE FUNCTION public.get_diagnostic_question(
  p_previous_correct boolean DEFAULT NULL,
  p_previous_difficulty_tier integer DEFAULT NULL,
  p_used_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_tier integer;
  v_question record;
BEGIN
  IF p_previous_correct IS NULL THEN
    v_target_tier := 2;
  ELSE
    v_target_tier := GREATEST(1, LEAST(3, COALESCE(p_previous_difficulty_tier, 2) + CASE WHEN p_previous_correct THEN 1 ELSE -1 END));
  END IF;

  SELECT q.id, q.question_text, q.options, q.category, q.difficulty, q.difficulty_tier
  INTO v_question
  FROM public.questions q
  WHERE q.id <> ALL(COALESCE(p_used_ids, '{}'::uuid[]))
    AND COALESCE(q.difficulty_tier, CASE WHEN lower(q.difficulty) IN ('easy', 'core') THEN 1 WHEN lower(q.difficulty) IN ('difficult', 'hard', 'stretch') THEN 3 ELSE 2 END) = v_target_tier
  ORDER BY random()
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT q.id, q.question_text, q.options, q.category, q.difficulty, q.difficulty_tier
    INTO v_question
    FROM public.questions q
    WHERE q.id <> ALL(COALESCE(p_used_ids, '{}'::uuid[]))
    ORDER BY abs(COALESCE(q.difficulty_tier, CASE WHEN lower(q.difficulty) IN ('easy', 'core') THEN 1 WHEN lower(q.difficulty) IN ('difficult', 'hard', 'stretch') THEN 3 ELSE 2 END) - v_target_tier), random()
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_question.id,
    'question_text', v_question.question_text,
    'options', v_question.options,
    'category', v_question.category,
    'difficulty', v_question.difficulty,
    'difficulty_tier', COALESCE(v_question.difficulty_tier, CASE WHEN lower(v_question.difficulty) IN ('easy', 'core') THEN 1 WHEN lower(v_question.difficulty) IN ('difficult', 'hard', 'stretch') THEN 3 ELSE 2 END)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_diagnostic_answer(
  p_question_id uuid,
  p_selected_answer text,
  p_time_taken_seconds integer,
  p_answer_changes_count integer DEFAULT 0,
  p_session_id uuid DEFAULT extensions.gen_random_uuid(),
  p_question_position integer DEFAULT 1,
  p_previous_question_correct boolean DEFAULT NULL,
  p_time_to_first_click integer DEFAULT 0,
  p_used_ids uuid[] DEFAULT '{}',
  p_previous_difficulty_tier integer DEFAULT NULL,
  p_is_final boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_correct_answer text;
  v_is_correct boolean;
  v_next jsonb;
BEGIN
  SELECT q.correct_answer INTO v_correct_answer FROM public.questions q WHERE q.id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Diagnostic question not found';
  END IF;

  v_is_correct := upper(trim(p_selected_answer)) = upper(trim(v_correct_answer));

  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.user_attempts (user_id, question_id, selected_answer, time_taken_seconds, answer_changes_count, is_correct, session_id, time_to_first_click, question_position, previous_question_correct)
    VALUES (auth.uid(), p_question_id, p_selected_answer, GREATEST(0, COALESCE(p_time_taken_seconds, 0)), GREATEST(0, COALESCE(p_answer_changes_count, 0)), v_is_correct, p_session_id, GREATEST(0, COALESCE(p_time_to_first_click, 0)), GREATEST(1, COALESCE(p_question_position, 1)), p_previous_question_correct);
  END IF;

  IF p_is_final THEN
    RETURN jsonb_build_object('is_correct', v_is_correct, 'final', true);
  END IF;

  v_next := public.get_diagnostic_question(v_is_correct, p_previous_difficulty_tier, p_used_ids);

  RETURN jsonb_build_object('is_correct', v_is_correct, 'final', false, 'next_question', v_next);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_diagnostic_question(boolean, integer, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_diagnostic_answer(uuid, text, integer, integer, uuid, integer, boolean, integer, uuid[], integer, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_diagnostic_question(boolean, integer, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_diagnostic_answer(uuid, text, integer, integer, uuid, integer, boolean, integer, uuid[], integer, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';