import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PracticeSkeleton } from '@/components/skeletons/PageSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  finishPieSession, nextPieQuestion, resumePieSession, startPieSession, submitPieAnswer,
  type PieSessionQuestion,
} from '@/lib/pie/pie-practice-client';
import type { V2PracticeResult } from '@/lib/migration/v2-practice-session';
import { syncPieEngine } from '@/lib/pie/pie-engine-client';
import { describePieFailure, pieSyncFailure } from '@/lib/pie/pie-diagnostics';

export interface PieResultQuestion {
  id: string;
  zyntra_id?: string | null;
  question_text: string;
  options: string[];
  /** From the answered-only results RPC: empty for unanswered questions. */
  correct_answer: string;
  explanation: string | null;
  category: string;
  subtopic?: string | null;
  difficulty?: string;
}

export interface PieDrillConfig {
  mode: 'recharge' | 'no-change' | 'full-mock';
  questionCount: number;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function resultsToQuestions(results: V2PracticeResult[]): {
  questions: PieResultQuestion[]; answers: Record<number, string>; changes: Record<number, number>; times: Record<number, number>;
} {
  const questions: PieResultQuestion[] = []; const answers: Record<number, string> = {};
  const changes: Record<number, number> = {}; const times: Record<number, number> = {};
  [...results].sort((a, b) => a.question_position - b.question_position).forEach((r, i) => {
    questions.push({
      id: r.question_id, zyntra_id: r.zyntra_id, question_text: r.stem,
      options: Array.isArray(r.options) ? (r.options as string[]) : [],
      correct_answer: r.correct_answer ?? '', explanation: r.explanation ?? null,
      category: '', subtopic: null, difficulty: r.difficulty_tier ?? undefined,
    });
    if (r.selected_answer) answers[i] = r.selected_answer;
    changes[i] = r.answer_changes_count || 0;
    times[i] = r.time_taken_seconds || 0;
  });
  return { questions, answers, changes, times };
}

/**
 * P5 Practice drill: server-selected (pie_create_session / pie_next_question), server-graded
 * (save_attempt on each answer, so an answer is final once you move on), results and
 * explanations only from get_practice_session_results (answered questions only).
 */
export function PieDrillSession({ config, resumeSessionId, onFinish }: {
  config: PieDrillConfig;
  resumeSessionId?: string | null;
  onFinish: (questions: PieResultQuestion[], answers: Record<number, string>, changes: Record<number, number>, times: Record<number, number>, ruledOut: Record<number, string[]>) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const target = Math.max(1, Math.min(50, config.questionCount));
  const totalSeconds = config.mode === 'full-mock' ? 210 * 60 : target * 60;
  const [questions, setQuestions] = useState<PieSessionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [sequence, setSequence] = useState<Record<number, string[]>>({});
  const [confidence, setConfidence] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(totalSeconds);
  const sessionRef = useRef<string | null>(null);
  const localIdRef = useRef(resumeSessionId || crypto.randomUUID());
  const shownAtRef = useRef(Date.now());
  const firstClickRef = useRef<Record<number, number>>({});
  const timesRef = useRef<Record<number, number>>({});
  const finishingRef = useRef(false);

  const persistResumePointer = useCallback(async (sessionId: string, qs: PieSessionQuestion[]) => {
    if (!user) return;
    try {
      await supabase.from('active_sessions').upsert({
        user_id: user.id, session_id: localIdRef.current, session_type: 'mcq',
        config: { ...config, v2SessionId: sessionId, selector: 'pie' } as never,
        question_ids: qs.map(q => q.question_id), updated_at: new Date().toISOString(),
      } as never, { onConflict: 'session_id' });
    } catch (e) { console.warn('[PIE] resume pointer not saved', e); }
  }, [user, config]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let qs: PieSessionQuestion[];
        if (resumeSessionId && user) {
          const { data } = await supabase.from('active_sessions').select('config').eq('session_id', resumeSessionId).eq('user_id', user.id).single();
          const v2Id = (data?.config as Record<string, unknown> | null)?.v2SessionId;
          // Hard failure, never a silent fresh/legacy fallback.
          if (typeof v2Id !== 'string') throw new Error('This session cannot be resumed. Please start a new one.');
          sessionRef.current = v2Id;
          qs = await resumePieSession(v2Id);
        } else {
          const started = await startPieSession(target);
          sessionRef.current = started.sessionId;
          qs = started.questions;
          await persistResumePointer(started.sessionId, qs);
        }
        if (cancelled) return;
        const done: Record<number, boolean> = {};
        qs.forEach((q, i) => { if (q.answered_at) done[i] = true; });
        setQuestions(qs); setSaved(done);
        const firstOpen = qs.findIndex(q => !q.answered_at);
        setIndex(firstOpen === -1 ? Math.max(0, qs.length - 1) : firstOpen);
        shownAtRef.current = Date.now();
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Practice could not start.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordTime = () => {
    timesRef.current[index] = (timesRef.current[index] || 0) + Math.round((Date.now() - shownAtRef.current) / 1000);
    shownAtRef.current = Date.now();
  };

  const choose = (letter: string) => {
    if (saved[index]) return;
    if (firstClickRef.current[index] == null) firstClickRef.current[index] = Date.now() - shownAtRef.current;
    if (config.mode !== 'recharge' && selected[index]) return; // no-change / mock: first choice is final
    setSelected(s => ({ ...s, [index]: letter }));
    setSequence(s => ({ ...s, [index]: [...(s[index] || []), letter] }));
  };

  const saveCurrent = async (): Promise<boolean> => {
    const q = questions[index];
    if (!q || saved[index] || !sessionRef.current) return true;
    const answer = selected[index];
    if (!answer) return false;
    recordTime();
    await submitPieAnswer({
      questionId: q.question_id, sessionId: sessionRef.current, selectedAnswer: answer,
      timeTakenSeconds: timesRef.current[index] || 0, confidenceLevel: confidence[index] ?? null,
      timeToFirstClick: firstClickRef.current[index] ?? null, changeSequence: sequence[index] || [answer],
      timeOfDay: new Date().toISOString(), questionPosition: q.question_position,
      questionVersion: q.version ?? null, provenance: { source: 'practice-pie', mode: config.mode },
    });
    setSaved(s => ({ ...s, [index]: true }));
    // One answer is evidence, but PIE stays "building" until 6 observations.
    void syncPieEngine().catch((error) => console.warn('[PIE] sync after answer failed', error));
    return true;
  };

  const finish = useCallback(async () => {
    if (finishingRef.current || !sessionRef.current) return;
    finishingRef.current = true; setBusy(true);
    try {
      if (selected[index] && !saved[index]) await saveCurrent();
      const results = await finishPieSession(sessionRef.current);
      if (user) await supabase.from('active_sessions').delete().eq('session_id', localIdRef.current);
      // PIE state refresh is downstream and never blocks completion; failures are surfaced.
      void syncPieEngine().then((result) => {
        const failure = pieSyncFailure(result);
        if (failure) toast({ ...describePieFailure(failure), variant: 'destructive' });
      });
      const r = resultsToQuestions(results);
      onFinish(r.questions, r.answers, r.changes, r.times, {});
    } catch (e) {
      finishingRef.current = false;
      toast({ title: 'Session not completed', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, selected, saved, user, onFinish]);

  const next = async () => {
    setBusy(true);
    try {
      if (!(await saveCurrent())) { toast({ title: 'Choose an answer first' }); return; }
      if (index + 1 < questions.length) { setIndex(index + 1); shownAtRef.current = Date.now(); return; }
      if (questions.length < target && sessionRef.current) {
        const q = await nextPieQuestion(sessionRef.current);
        if (q) { setQuestions(prev => [...prev, q]); setIndex(index + 1); shownAtRef.current = Date.now(); return; }
      }
      await finish();
    } catch (e) {
      toast({ title: 'Answer not saved', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (loading || error) return;
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) { clearInterval(t); void finish(); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [loading, error, finish]);

  if (loading) return <AppLayout><PracticeSkeleton /></AppLayout>;
  if (error) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-16">
          <Card className="border-destructive/30"><CardContent className="p-6">
            <p className="font-semibold">Practice could not start</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={() => { window.location.href = '/practice'; }}>Go Back</Button>
          </CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  const q = questions[index];
  const options = Array.isArray(q?.options) ? (q.options as string[]) : [];
  const isLast = index + 1 >= questions.length && questions.length >= target;
  const mm = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <div className="flex items-center justify-between">
          <Badge variant="outline">Question {index + 1} of {Math.max(questions.length, target)}</Badge>
          <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{mm}</Badge>
        </div>
        {q && (
          <Card><CardContent className="space-y-4 p-6">
            <p className="whitespace-pre-line text-base leading-relaxed" data-testid="pie-stem">{q.stem}</p>
            <div className="space-y-2">
              {options.map((opt, i) => {
                const letter = LETTERS[i];
                const active = selected[index] === letter;
                return (
                  <button key={letter} type="button" disabled={saved[index] || busy}
                    onClick={() => choose(letter)}
                    className={cn('w-full rounded-md border p-3 text-left text-sm', active ? 'border-primary bg-primary/10' : 'border-border')}>
                    <span className="mr-2 font-semibold">{letter}.</span>{opt}
                  </button>
                );
              })}
            </div>
            {!saved[index] && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Confidence:
                {[1, 2, 3, 4, 5].map(v => (
                  <Button key={v} size="sm" variant={confidence[index] === v ? 'default' : 'outline'}
                    aria-label={`Confidence ${v} of 5`} onClick={() => setConfidence(c => ({ ...c, [index]: v }))}>{v}</Button>
                ))}
              </div>
            )}
            {saved[index] && <p className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle className="h-3 w-3" />Answer saved. Results and explanations appear when you finish.</p>}
          </CardContent></Card>
        )}
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="gap-1" disabled={index === 0 || config.mode === 'full-mock' || busy}
            onClick={() => { recordTime(); setIndex(index - 1); }}>
            <ChevronLeft className="h-4 w-4" />Back
          </Button>
          {isLast
            ? <Button className="gap-1" disabled={busy} onClick={() => void finish()}>Finish <CheckCircle className="h-4 w-4" /></Button>
            : <Button className="gap-1" disabled={busy} onClick={() => void next()}>Next <ChevronRight className="h-4 w-4" /></Button>}
        </div>
      </div>
    </AppLayout>
  );
}
