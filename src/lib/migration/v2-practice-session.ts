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

/**
 * P3 cutover: the main client IS the hkow (V2) client, so there is no auth bridge any more. This only
 * asserts the main client has a live session; the v2-auth-bridge edge function is no longer called.
 */
export async function ensureV2Session(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) {
    throw new Error('Your current Zyntra session has expired. Please sign in again.');
  }
}

/** Kept for callers: with a single client there is no separate V2 session to clear. Never throws. */
export async function signOutV2Local(): Promise<void> {
  // no-op: signing out the main client (AuthContext) is the only sign-out.
}

// P5: the client-chosen-ids session creator (create_practice_session) was
// removed; sessions are created only by the PIE server RPC pie_create_session.

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
  // PIE is rebuilt through the authenticated public wrapper (auth.uid() must equal p_user_id);
  // the internal pie schema is never called from the browser.
  try {
    const v2 = getSupabaseV2();
    const [refresh, rebuild] = await Promise.allSettled([
      v2.rpc('refresh_candidate_intelligence'),
      data?.user_id
        ? v2.rpc('rebuild_candidate_state', { p_user_id: data.user_id })
        : Promise.resolve({ data: null, error: { message: 'Completed session returned no user_id' } }),
    ]);
    if (refresh.status === 'rejected' || refresh.value.error) {
      console.warn('[V2] Canonical intelligence refresh failed (non-blocking):',
        refresh.status === 'rejected' ? refresh.reason : refresh.value.error);
    }
    if (rebuild.status === 'rejected' || rebuild.value.error) {
      console.warn('[PIE] Candidate-state rebuild after session completion failed (non-blocking):',
        rebuild.status === 'rejected' ? rebuild.reason : rebuild.value.error);
    }
  } catch (intelligenceError) {
    console.warn('[V2] Candidate intelligence refresh skipped:', intelligenceError);
  }

  return data as V2PracticeSession;
}

/** B1 (PR #56): audited server-side erase of the caller's own learning data. */
export async function eraseMyLearningDataV2(): Promise<Record<string, number>> {
  await ensureV2Session();
  const { data, error } = await getSupabaseV2().rpc('erase_my_learning_data', { p_confirm: 'ERASE_MY_LEARNING_DATA' });
  if (error) throw new Error(error.message || 'Learning data erase failed.');
  return (data ?? {}) as Record<string, number>;
}
