import { getSupabaseV2 } from '@/integrations/supabase/v2-client';

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
  subject_id: string | null;
  subtopic_id: string | null;
  difficulty_tier: string | null;
  version: number | null;
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
  return data as V2PracticeSession;
}
