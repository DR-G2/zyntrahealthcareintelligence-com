import { supabase } from '@/lib/supabase';

export type BehaviorEventType =
  | 'QUESTION_OPENED'
  | 'QUESTION_FIRST_INTERACTION'
  | 'ANSWER_SELECTED'
  | 'ANSWER_CHANGED'
  | 'CONFIDENCE_SET'
  | 'QUESTION_SUBMITTED'
  | 'SESSION_STARTED'
  | 'SESSION_RESUMED'
  | 'SESSION_COMPLETED'
  | 'SESSION_ABANDONED';

interface EmitBehaviorEventInput {
  eventType: BehaviorEventType;
  sessionId?: string | null;
  questionId?: string | null;
  sequenceNo?: number | null;
  payload?: Record<string, unknown>;
}

export async function emitBehaviorEvent({
  eventType,
  sessionId = null,
  questionId = null,
  sequenceNo = null,
  payload = {},
}: EmitBehaviorEventInput): Promise<void> {
  try {
    const { error } = await supabase.from('behavior_events').insert({
      event_type: eventType,
      session_id: sessionId,
      question_id: questionId,
      sequence_no: sequenceNo,
      payload,
      occurred_at: new Date().toISOString(),
    } as any);

    if (error) {
      // Telemetry must never block exam/practice flow.
      console.warn('[telemetry] event write failed', eventType, error);
    }
  } catch (error) {
    console.warn('[telemetry] event write failed', eventType, error);
  }
}
