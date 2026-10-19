import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PracticeSkeleton } from '@/components/skeletons/PageSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  finishPieSession, getNudgeProgress, nextPieQuestion, resumePieSession, startNudgeSession, startPieSession, submitPieAnswer,
  type NudgeSessionTarget, type PieSessionQuestion,
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
  primaryMode?: 'drill' | 'nudge' | 'mock';
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
export interface NudgeOutcome {
  target: NudgeSessionTarget;
  followUpAccuracy: number | null;
  followUpQuestionCount: number;
  followUpCorrectCount: number;
  reassessmentAvailable: boolean;
}

export function PieDrillSession({ config, resumeSessionId, onFinish }: {
  config: PieDrillConfig;
  resumeSessionId?: string | null;
  onFinish: (questions: PieResultQuestion[], answers: Record<number, string>, changes: Record<number, number>, times: Record<number, number>, ruledOut: Record<number, string[]>, nudgeOutcome?: NudgeOutcome | null) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const target = Math.max(1, Math.min(50, config.questionCount));
  const totalSeconds = config.mode === 'full-mock' ? 210 * 60 : target * 60;
  const [questions, setQuestions] = useState<PieSessionQuestion[]>([]);
  const [nudgeTarget, setNudgeTarget] = useState<NudgeSessionTarget | null>(null);
  const [primaryMode, setPrimaryMode] = useState<'drill' | 'nudge' | 'mock'>(config.primaryMode ?? 'drill');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [sequence, setSequence] = useState<Record<number, string[]>>({});
  const [confidence, setConfidence] = useState<Record<number, number>>({});
  const [confidenceError, setConfidenceError] = useState(false);
  const [ruledOut, setRuledOut] = useState<Record<number, string[]>>({});
  const ruleEventsRef = useRef<Record<number, { option: string; action: string; at_ms: number }[]>>({});
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

  const persistResumePointer = useCallback(async (sessionId: string, qs: PieSessionQuestion[], target?: NudgeSessionTarget | null) => {
    if (!user) return;
    try {
      await supabase.from('active_sessions').upsert({
        user_id: user.id, session_id: localIdRef.current, session_type: 'mcq',
        config: { ...config, v2SessionId: sessionId, selector: 'pie', nudgeTarget: target ?? null } as never,
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
          const storedConfig = (data?.config as Record<string, unknown> | null) ?? {};
          const v2Id = storedConfig.v2SessionId;
          if (storedConfig.primaryMode === 'nudge' || storedConfig.primaryMode === 'drill' || storedConfig.primaryMode === 'mock') {
            setPrimaryMode(storedConfig.primaryMode);
          }
          const storedTarget = storedConfig.nudgeTarget as NudgeSessionTarget | null | undefined;
          if (storedTarget?.loTitle) setNudgeTarget(storedTarget);
          // Hard failure, never a silent fresh/legacy fallback.
          if (typeof v2Id !== 'string') throw new Error('This session cannot be resumed. Please start a new one.');
          sessionRef.current = v2Id;
          qs = await resumePieSession(v2Id);
        } else {
          if (primaryMode === 'nudge') {
            const started = await startNudgeSession(target);
            sessionRef.current = started.sessionId;
            qs = started.questions;
            setNudgeTarget(started.target);
            await persistResumePointer(started.sessionId, qs, started.target);
          } else {
            const started = await startPieSession(target);
            sessionRef.current = started.sessionId;
            qs = started.questions;
            await persistResumePointer(started.sessionId, qs);
          }
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
    if ((ruledOut[index] || []).includes(letter)) return; // must un-rule explicitly first
    if (firstClickRef.current[index] == null) firstClickRef.current[index] = Date.now() - shownAtRef.current;
    if (config.mode !== 'recharge' && selected[index]) return; // no-change / mock: first choice is final
    setSelected(s => ({ ...s, [index]: letter }));
    setSequence(s => ({ ...s, [index]: [...(s[index] || []), letter] }));
  };

  const toggleRuleOut = (letter: string) => {
    if (saved[index]) return;
    const current = ruledOut[index] || [];
    const on = !current.includes(letter);
    if (on && selected[index] === letter) return; // cannot rule out the selected answer
    setRuledOut(r => ({ ...r, [index]: on ? [...current, letter] : current.filter(l => l !== letter) }));
    ruleEventsRef.current[index] = [...(ruleEventsRef.current[index] || []),
      { option: letter, action: on ? 'ruled_out' : 'restored', at_ms: Date.now() - shownAtRef.current }];
  };

  /** Returns 'ok' | 'no-answer' | 'no-confidence'. Throws if saving fails (caller must not advance). */
  const saveCurrent = async (): Promise<'ok' | 'no-answer' | 'no-confidence'> => {
    const q = questions[index];
    if (!q || saved[index] || !sessionRef.current) return 'ok';
    const answer = selected[index];
    if (!answer) return 'no-answer';
    const conf = confidence[index];
    if (!conf || conf < 1 || conf > 5) { setConfidenceError(true); return 'no-confidence'; }
    recordTime();
    try {
      await submitPieAnswer({
        questionId: q.question_id, sessionId: sessionRef.current, selectedAnswer: answer,
        timeTakenSeconds: timesRef.current[index] || 0, confidenceLevel: conf,
        timeToFirstClick: firstClickRef.current[index] ?? null, changeSequence: sequence[index] || [answer],
        timeOfDay: new Date().toISOString(), questionPosition: q.question_position,
        questionVersion: q.version ?? null,
        provenance: {
          source: 'practice-pie', mode: primaryMode === 'nudge' ? 'nudge' : config.mode,
          entry: primaryMode === 'nudge' ? 'nudge' : 'mcq_drill',
          ruled_out_final: ruledOut[index] || [], rule_out_events: ruleEventsRef.current[index] || [],
        },
      });
    } catch (e) {
      // A retry after a lost response: the server already holds this answer, so it is saved.
      if (!/attempt_already_submitted/.test((e as Error)?.message ?? '')) throw e;
    }
    setSaved(s => ({ ...s, [index]: true }));
    // One answer is evidence, but PIE stays "building" until 6 observations.
    void syncPieEngine().catch((error) => console.warn('[PIE] sync after answer failed', error));
    return 'ok';
  };

  const finish = useCallback(async (forced = false) => {
    if (finishingRef.current || !sessionRef.current) return;
    finishingRef.current = true; setBusy(true);
    try {
      if (selected[index] && !saved[index]) {
        const status = await saveCurrent();
        // Manual finish never drops an answer silently; on timer expiry an answer without confidence is not saved.
        if (status === 'no-confidence' && !forced) { finishingRef.current = false; return; }
      }
      const results = await finishPieSession(sessionRef.current);
      if (user) await supabase.from('active_sessions').delete().eq('session_id', localIdRef.current);
      // PIE state refresh is downstream and never blocks completion; failures are surfaced.
      void syncPieEngine().then((result) => {
        const failure = pieSyncFailure(result);
        if (failure) toast({ ...describePieFailure(failure), variant: 'destructive' });
      });
      const r = resultsToQuestions(results);
      let nudgeOutcome: NudgeOutcome | null = null;
      if (primaryMode === 'nudge' && nudgeTarget?.loId) {
        try {
          const followUp = await getNudgeProgress(nudgeTarget.loId);
          nudgeOutcome = {
            target: nudgeTarget, followUpAccuracy: followUp.accuracy,
            followUpQuestionCount: followUp.distinctQuestionCount,
            followUpCorrectCount: followUp.correctCount, reassessmentAvailable: true,
          };
        } catch (reassessmentError) {
          console.warn('[Nudge] post-session reassessment unavailable', reassessmentError);
          nudgeOutcome = {
            target: nudgeTarget, followUpAccuracy: null, followUpQuestionCount: 0,
            followUpCorrectCount: 0, reassessmentAvailable: false,
          };
        }
      }
      onFinish(r.questions, r.answers, r.changes, r.times, ruledOut, nudgeOutcome);
    } catch (e) {
      finishingRef.current = false;
      toast({ title: 'Session not completed', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, selected, saved, confidence, ruledOut, user, onFinish, primaryMode, nudgeTarget]);

  const next = async () => {
    setBusy(true);
    try {
      const status = await saveCurrent();
      if (status === 'no-answer') { toast({ title: 'Choose an answer first' }); return; }
      if (status === 'no-confidence') return;
      if (index + 1 < questions.length) { setIndex(index + 1); shownAtRef.current = Date.now(); return; }
      if (primaryMode !== 'nudge' && questions.length < target && sessionRef.current) {
        const q = await nextPieQuestion(sessionRef.current);
        if (q) { setQuestions(prev => [...prev, q]); setIndex(index + 1); shownAtRef.current = Date.now(); return; }
      }
      await finish();
    } catch (e) {
      toast({ title: 'Answer not saved', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  useEffect(() => { setConfidenceError(false); }, [index]);

  useEffect(() => {
    if (loading || error) return;
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) { clearInterval(t); void finish(true); return 0; }
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
  const isLast = index + 1 >= questions.length && (primaryMode === 'nudge' || questions.length >= target);
  const mm = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  const isMock = config.mode === 'full-mock';
  const modeLabel = primaryMode === 'nudge' ? (nudgeTarget?.loId ? 'Nudge · PIE-targeted learning' : 'Nudge · Evidence-building mix') : isMock ? 'Full Mock Exam' : config.mode === 'recharge' ? 'MCQ Drill · With option change' : 'MCQ Drill · No option change';
  const shownTotal = primaryMode === 'nudge' && questions.length > 0 ? questions.length : Math.max(questions.length, target);
  const lowTime = isMock && remaining <= 600;

  const questionNavigation = (className: string) => (
    <nav aria-label="Question navigation" className={className}>
      <div className="mx-auto w-full max-w-3xl">
        {!saved[index] && (!selected[index] || !confidence[index]) && (
          <p id="answer-action-hint" role="status" aria-live="polite" className="mb-2 text-xs text-muted-foreground">
            Select an answer and a confidence level to continue.
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          {isMock ? <span /> : (
            <Button variant="ghost" className="min-h-11 gap-1" disabled={index === 0 || busy}
              onClick={() => { recordTime(); setIndex(index - 1); }}>
              <ChevronLeft className="h-4 w-4" />Back
            </Button>
          )}
          {isLast
            ? isMock
              ? <AlertDialog>
                  <AlertDialogTrigger asChild><Button className="min-h-11 gap-1" disabled={busy}>Finish test <CheckCircle className="h-4 w-4" /></Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Finish the mock exam?</AlertDialogTitle>
                      <AlertDialogDescription>Your answers will be submitted and you won't be able to return to this exam.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Keep going</AlertDialogCancel><AlertDialogAction className="min-h-11" onClick={() => void finish()}>Finish test</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              : <Button className="min-h-11 gap-1" disabled={busy} onClick={() => void finish()}>Finish test <CheckCircle className="h-4 w-4" /></Button>
            : <Button className="min-h-11 gap-1" disabled={busy} onClick={() => void next()}>Next question <ChevronRight className="h-4 w-4" /></Button>}
        </div>
      </div>
    </nav>
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-2 md:pb-6">
        {primaryMode === 'nudge' && nudgeTarget?.loId && (
          <Card className="border-primary/25 bg-primary/5"><CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Nudge target · evidence-backed</p>
            <p className="font-semibold">{nudgeTarget.loTitle}</p>
            <p className="text-sm text-muted-foreground">Based on {nudgeTarget.baselineQuestionCount} distinct mapped questions · baseline accuracy {Math.round(nudgeTarget.baselineAccuracy * 100)}%.</p>
          </CardContent></Card>
        )}
        {primaryMode === 'nudge' && nudgeTarget && !nudgeTarget.loId && (
          <Card className="border-primary/25 bg-primary/5"><CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Nudge · evidence-building</p>
            <p className="font-semibold">Mixed AMC question set</p>
            <p className="text-sm text-muted-foreground">Your first 50 saved learning-objective interactions build the evidence PIE needs. This session starts at {nudgeTarget.baselineQuestionCount} of 50 mapped interactions. Questions are mixed and blueprint-eligible; no weakness is assumed.</p>
          </CardContent></Card>
        )}
        <header className="sticky top-14 z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md md:top-0 md:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-sm font-semibold text-primary">{modeLabel}</h1>
            <p className={cn('flex items-center gap-1.5 font-mono text-sm', lowTime ? 'text-destructive' : 'text-foreground')} aria-live={lowTime ? 'polite' : 'off'}>
              <Clock className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Time remaining </span>{mm}
            </p>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="shrink-0 text-xs text-muted-foreground">Question {index + 1} of {shownTotal}</span>
            <Progress value={((index + (saved[index] ? 1 : 0)) / shownTotal) * 100} className="h-1" aria-label="Session progress" />
          </div>
        </header>
        {q && (
          <section aria-label="Current question" className="space-y-6 py-4 sm:py-6">
            <p className="max-w-[70ch] whitespace-pre-line text-base leading-7" data-testid="pie-stem">{q.stem}</p>
            <div className="space-y-2" role="group" aria-label="Answer options">
              {options.map((opt, i) => {
                const letter = LETTERS[i];
                const active = selected[index] === letter;
                const out = (ruledOut[index] || []).includes(letter);
                return (
                  <div key={letter} className="flex items-stretch gap-2">
                    <Button variant="outline" type="button" disabled={saved[index] || busy || active}
                      aria-pressed={out} aria-label={out ? `Restore option ${letter}` : `Rule out option ${letter}`}
                      onClick={() => toggleRuleOut(letter)}
                      className={cn('flex h-auto min-h-12 w-11 shrink-0 items-center justify-center rounded-lg border p-0 text-sm transition-colors motion-reduce:transition-none disabled:opacity-40',
                        out ? 'border-muted-foreground/60 bg-muted text-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/40')}>
                      {out ? '↺' : '✕'}
                    </Button>
                    <Button variant="outline" type="button" disabled={saved[index] || busy || out} aria-pressed={active}
                      onClick={() => choose(letter)}
                      className={cn('flex h-auto min-h-14 min-w-0 w-full items-start justify-start gap-3 whitespace-normal rounded-lg border p-4 text-left text-sm leading-6 transition-colors motion-reduce:transition-none',
                        active ? 'border-primary bg-accent text-foreground' : 'border-border/60 bg-secondary hover:border-primary/40',
                        out && 'line-through opacity-50')}>
                      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs', active ? 'border-primary text-primary' : 'border-border/60 text-muted-foreground')}>{letter}</span>
                      <span>{opt}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
            {!saved[index] && (
              <div className="space-y-2 border-t border-border/60 pt-4">
                <p id="confidence-label" className="text-sm font-medium text-muted-foreground">How confident are you? <span className="text-foreground">(required)</span></p>
                <div className="grid grid-cols-5 gap-1.5 sm:max-w-sm" role="radiogroup" aria-labelledby="confidence-label">
                  {[1, 2, 3, 4, 5].map(v => (
                    <Button key={v} size="sm" role="radio" aria-checked={confidence[index] === v}
                      tabIndex={confidence[index] === v || (!confidence[index] && v === 1) ? 0 : -1}
                      onKeyDown={event => {
                        const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
                        if (!delta) return;
                        event.preventDefault(); const nextValue = ((v - 1 + delta + 5) % 5) + 1;
                        setConfidence(c => ({ ...c, [index]: nextValue })); setConfidenceError(false);
                        event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[aria-label="Confidence ${nextValue} of 5"]`)?.focus();
                      }}
                      variant={confidence[index] === v ? 'default' : 'outline'}
                      aria-label={`Confidence ${v} of 5`} className="min-h-11"
                      onClick={() => { setConfidence(c => ({ ...c, [index]: v })); setConfidenceError(false); }}>{v}</Button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground sm:max-w-sm"><span>Guessing</span><span>Certain</span></div>
                {confidenceError && !confidence[index] && (
                  <p role="alert" className="text-xs text-destructive">Select your confidence level to continue.</p>
                )}
              </div>
            )}
            {saved[index] && <p className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle className="h-3 w-3" />Answer saved. Results and explanations appear when you finish.</p>}
          </section>
        )}
        {isMobile && typeof document !== 'undefined'
          ? createPortal(
              questionNavigation('zh-phase3b training-genjutsu fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 border-t border-border/60 bg-background/95 px-4 py-2 shadow-[0_-12px_40px_rgba(0,0,0,0.24)] backdrop-blur-md'),
              document.body,
            )
          : !isMobile
            ? questionNavigation('flex items-center justify-between gap-3 border-t border-border/60 bg-background/90 px-4 py-3 md:border-0 md:bg-transparent md:p-0')
            : null}
      </div>
    </AppLayout>
  );
}
