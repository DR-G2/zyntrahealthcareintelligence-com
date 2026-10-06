import { getSupabaseV2 } from '@/integrations/supabase/v2-client';
import { supabase } from '@/lib/supabase';

export interface V2PracticeSession {
  id: string;
  user_id: string;
  session_type: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  config: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface V2PracticeQuestion {
  session_question_id: string;
  session_id: string;
  question_id: string;
  question_position: number;
  presented_at: string | null;
  answered_at: string | null;
  zyntra_id: string | null;
  stem: string;
  options: unknown;
  explanation: string | null;
  correct_answer?: string;
  subject_id: string | null;
  subtopic_id: string | null;
  difficulty_tier: string | null;
  version: number | null;
}

export async function ensureV2Session(): Promise<void> {
  const v2 = getSupabaseV2();
  const { data: existing } = await v2.auth.getSession();
  if (existing.session?.user?.email) return;

  const { data: legacySession } = await supabase.auth.getSession();
  const legacyAccessToken = legacySession.session?.access_token;
  if (!legacyAccessToken) throw new Error('Your current Zyntra session has expired. Please sign in again.');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_V2_URL}/functions/v1/v2-auth-bridge`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${legacyAccessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.token_hash) {
    throw new Error(payload?.error || 'V2 admin authentication could not be established.');
  }

  const { error } = await v2.auth.verifyOtp({
    token_hash: payload.token_hash,
    type: 'magiclink',
  });
  if (error) throw new Error(error.message || 'V2 admin authentication could not be established.');

  const { data: verified } = await v2.auth.getSession();
  if (!verified.session) throw new Error('V2 authentication completed without an active session.');
}

export async function getV2PracticeQuestionPool(limit = 100): Promise<V2PracticeQuestion[]> {
  const { data, error } = await getSupabaseV2().rpc('get_practice_question_pool', {
    p_limit: limit,
  });

  if (error) throw new Error(error.message || 'V2 Practice question pool could not be loaded.');
  return (data || []).map((q: any, index: number) => ({
    session_question_id: '',
    session_id: '',
    question_id: q.id,
    question_position: index,
    presented_at: null,
    answered_at: null,
    zyntra_id: q.zyntra_id,
    stem: q.stem,
    options: q.options,
    explanation: q.explanation,
    subject_id: q.subject_id,
    subtopic_id: q.subtopic_id,
    difficulty_tier: q.difficulty_tier,
    version: q.version,
  })) as V2PracticeQuestion[];
}

export async function createV2PracticeSession(
  sessionType: string,
  config: Record<string, unknown>,
  questionIds: string[],
): Promise<V2PracticeSession> {
  if (!questionIds.length) throw new Error('V2 Practice requires at least one question.');

  const { data, error } = await getSupabaseV2().rpc('create_practice_session', {
    p_session_type: sessionType,
    p_config: config,
    p_question_ids: questionIds,
  });

  if (error) throw new Error(error.message || 'V2 Practice session could not be created.');
  return data as V2PracticeSession;
}

export async function getV2PracticeQuestions(sessionId: string): Promise<V2PracticeQuestion[]> {
  const { data, error } = await getSupabaseV2().rpc('get_practice_session_questions', {
    p_session_id: sessionId,
  });

  if (error) throw new Error(error.message || 'V2 Practice questions could not be loaded.');
  return (data || []) as V2PracticeQuestion[];
}

export interface V2PracticeResult extends V2PracticeQuestion {
  correct_answer: string;
  selected_answer: string | null;
  is_correct: boolean | null;
  confidence_level: number | null;
  time_taken_seconds: number | null;
  answer_changes_count: number;
}

export async function getV2PracticeResults(sessionId: string): Promise<V2PracticeResult[]> {
  const { data, error } = await getSupabaseV2().rpc('get_practice_session_results', {
    p_session_id: sessionId,
  });

  if (error) throw new Error(error.message || 'V2 Practice results could not be loaded.');
  return (data || []) as V2PracticeResult[];
}

export async function resumeV2PracticeSession(sessionId: string): Promise<V2PracticeSession> {
  const { data, error } = await getSupabaseV2().rpc('resume_practice_session', {
    p_session_id: sessionId,
  });

  if (error) throw new Error(error.message || 'V2 Practice session could not be resumed.');
  return data as V2PracticeSession;
}

export async function completeV2PracticeSession(sessionId: string): Promise<V2PracticeSession> {
  const { data, error } = await getSupabaseV2().rpc('complete_practice_session', {
    p_session_id: sessionId,
  });

  if (error) throw new Error(error.message || 'V2 Practice session could not be completed.');

  // Intelligence is deliberately best-effort. A readiness rebuild must never block answer/session completion.
  try {
    await getSupabaseV2().rpc('refresh_candidate_intelligence');
  } catch (intelligenceError) {
    console.warn('[V2] Candidate intelligence refresh skipped:', intelligenceError);
  }

  return data as V2PracticeSession;
}
