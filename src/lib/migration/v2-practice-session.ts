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
  const { data: legacySession } = await supabase.auth.getSession();
  const legacyAccessToken = legacySession.session?.access_token;
  const legacyEmail = legacySession.session?.user?.email?.toLowerCase() ?? '';

  const { data: existing } = await v2.auth.getSession();
  const existingEmail = existing.session?.user?.email?.toLowerCase() ?? '';

  if (!legacyAccessToken) {
    // Never keep acting as a V2 identity once the Zyntra session is gone.
    if (existing.session) await v2.auth.signOut({ scope: 'local' }).catch(() => undefined);
    throw new Error('Your current Zyntra session has expired. Please sign in again.');
  }

  // The persisted V2 session must belong to the currently signed-in Zyntra user.
  // A stale V2 session from another account on the same browser is discarded.
  if (existingEmail && legacyEmail && existingEmail === legacyEmail) return;
  if (existing.session) await v2.auth.signOut({ scope: 'local' }).catch(() => undefined);

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_V2_URL}/functions/v1/v2-auth-bridge`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${legacyAccessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
    type: 'email',
  });
  if (error) throw new Error(error.message || 'V2 admin authentication could not be established.');

  const { data: verified } = await v2.auth.getSession();
  if (!verified.session) throw new Error('V2 authentication completed without an active session.');
}

/** Best-effort local V2 sign-out, used when the Zyntra session ends. Never throws. */
export async function signOutV2Local(): Promise<void> {
  try {
    await getSupabaseV2().auth.signOut({ scope: 'local' });
  } catch {
    // V2 may be unconfigured in this build; nothing to clear.
  }
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
