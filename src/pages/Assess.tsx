import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { emitBehaviorEvent } from '@/lib/telemetry';
import { syncPieEngine } from '@/lib/pie/pie-engine-client';
import { pieSyncFailure } from '@/lib/pie/pie-diagnostics';
import {
  startPieDiagnostic,
  resumePieSession,
  submitPieAnswer,
  finishPieSession,
  pieSessionErrorMessage,
  PIE_DIAGNOSTIC_DEFAULT_COUNT,
  type PieSessionQuestion,
} from '@/lib/pie/pie-practice-client';

/**
 * P5 Assess: the PIE diagnostic. The server builds a blueprint-balanced fixed set
 * (pie_create_session p_mode 'pie_diagnostic'); questions arrive without key or explanation;
 * on Submit every answered item goes through save_attempt (server-graded) in that
 * PIE-registered session and the session is completed, so the answers count as PIE
 * evidence. There is no client-side question pool, sequencing or grading.
 */
const TOTAL_TIME_SECONDS = 20 * 60;
const QUESTION_COUNT = PIE_DIAGNOSTIC_DEFAULT_COUNT;
const resumeKey = (uid: string) => `pie:diagnostic:${uid}`;

function optionList(options: unknown): string[] {
  if (Array.isArray(options)) return options.map(String);
  if (options && typeof options === 'object') return Object.values(options as Record<string, unknown>).map(String);
  return [];
}

export default function Assess() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [phase, setPhase] = useState<'intro' | 'starting' | 'test' | 'submitting'>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PieSessionQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [changeSequences, setChangeSequences] = useState<Record<number, string[]>>({});
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [timeToFirstClick, setTimeToFirstClick] = useState<Record<number, number>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(TOTAL_TIME_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const begin = async () => {
    if (!user) return;
    setPhase('starting');
    setError(null);
    try {
      let sid: string; let qs: PieSessionQuestion[];
      try {
        ({ sessionId: sid, questions: qs } = await startPieDiagnostic(QUESTION_COUNT));
      } catch (e: any) {
        const stored = localStorage.getItem(resumeKey(user.id));
        if (/PIE_DIAGNOSTIC_ACTIVE/.test(e?.message || '') && stored) {
          sid = stored; qs = await resumePieSession(stored);
        } else throw e;
      }
      localStorage.setItem(resumeKey(user.id), sid);
      setSessionId(sid);
      setQuestions(qs);
      setCurrentIndex(Math.max(0, qs.findIndex((q) => !q.answered_at)));
      setQuestionStartTime(Date.now());
      setPhase('test');
      void emitBehaviorEvent({ userId: user.id, eventType: 'SESSION_STARTED', sessionId: sid, payload: { mode: 'pie_diagnostic', question_count: qs.length } });
    } catch (e: any) {
      setError(pieSessionErrorMessage(e?.message || 'The diagnostic could not start.'));
      setPhase('intro');
    }
  };

  const recordQuestionTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setQuestionTimes((prev) => ({ ...prev, [currentIndex]: (prev[currentIndex] || 0) + elapsed }));
  }, [currentIndex, questionStartTime]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || !sessionId || !user) return;
    submittingRef.current = true;
    setPhase('submitting');
    const elapsedNow = Math.round((Date.now() - questionStartTime) / 1000);
    const times = { ...questionTimes, [currentIndex]: (questionTimes[currentIndex] || 0) + elapsedNow };
    try {
      for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        const answer = selectedAnswers[i];
        if (!answer || q.answered_at) continue; // unanswered stay unanswered; already-saved stay final
        await submitPieAnswer({
          questionId: q.question_id,
          sessionId,
          selectedAnswer: answer,
          timeTakenSeconds: times[i] ?? null,
          timeToFirstClick: timeToFirstClick[i] ?? null,
          changeSequence: changeSequences[i] ?? null,
          questionPosition: q.question_position,
          timeOfDay: new Date().toISOString(),
          provenance: { source: 'assess', mode: 'pie_diagnostic' },
        });
      }
      const results = await finishPieSession(sessionId);
      localStorage.removeItem(resumeKey(user.id));
      void emitBehaviorEvent({ userId: user.id, eventType: 'SESSION_COMPLETED', sessionId, payload: { question_count: questions.length, mode: 'pie_diagnostic' } });
      void syncPieEngine().then(pieSyncFailure);
      const answered = results.filter((r) => r.selected_answer);
      const changes = answered.reduce((s, r) => s + (r.answer_changes_count || 0), 0);
      navigate('/profile', { state: { performanceData: {
        stability_score: answered.length ? Math.round(Math.max(0, 100 - (changes / answered.length) * 50)) : null,
        diagnostic: { answered: answered.length, correct: answered.filter((r) => r.is_correct).length, total: questions.length },
      } } });
    } catch (e: any) {
      console.error('[PIE_DIAGNOSTIC]', JSON.stringify({ code: 'PIE_ATTEMPT_WRITE_FAILED', message: e?.message }));
      toast({ title: 'Answers not saved', description: e?.message || 'Please try again.', variant: 'destructive' });
      submittingRef.current = false;
      setPhase('test');
    }
  }, [sessionId, user, questions, selectedAnswers, questionTimes, currentIndex, questionStartTime, timeToFirstClick, changeSequences, navigate, toast]);

  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  useEffect(() => {
    if (phase !== 'test') return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) { clearInterval(interval); void submitRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (!user || phase !== 'test' || !sessionId) return;
    const q = questions[currentIndex];
    if (!q) return;
    void emitBehaviorEvent({ userId: user.id, eventType: 'QUESTION_OPENED', sessionId, questionId: q.question_id, sequenceNo: currentIndex, payload: { question_position: currentIndex } });
  }, [user, phase, sessionId, currentIndex, questions]);

  const selectAnswer = (answer: string) => {
    const q = questions[currentIndex];
    if (!q || q.answered_at) return;
    if (timeToFirstClick[currentIndex] === undefined) {
      setTimeToFirstClick((prev) => ({ ...prev, [currentIndex]: Math.round((Date.now() - questionStartTime) / 1000) }));
    }
    setChangeSequences((prev) => ({ ...prev, [currentIndex]: [...(prev[currentIndex] || []), answer] }));
    const prevAnswer = selectedAnswers[currentIndex];
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: answer }));
    void emitBehaviorEvent({ userId: user?.id ?? '', eventType: prevAnswer && prevAnswer !== answer ? 'ANSWER_CHANGED' : 'ANSWER_SELECTED', sessionId: sessionId ?? undefined, questionId: q.question_id, sequenceNo: currentIndex, payload: { has_previous_answer: Boolean(prevAnswer) } });
  };

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    recordQuestionTime();
    setCurrentIndex(index);
    setQuestionStartTime(Date.now());
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  const timerPercent = (timeRemaining / TOTAL_TIME_SECONDS) * 100;

  if (phase === 'intro' || phase === 'starting') {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <AlertTriangle className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl font-display">AMC Diagnostic Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-muted p-4 space-y-3">
                  <p className="font-medium">What to expect:</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2"><Clock className="h-4 w-4 mt-0.5 text-primary" />
                      <span><strong>Up to {QUESTION_COUNT} questions</strong> in {TOTAL_TIME_SECONDS / 60} minutes, balanced across the AMC blueprint</span></li>
                    <li className="flex items-start gap-2"><Lock className="h-4 w-4 mt-0.5 text-primary" />
                      <span>You can change answers until you submit; answers are graded securely on submit</span></li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" />
                      <span>Your results seed adaptive Practice. One diagnostic per 24 hours.</span></li>
                  </ul>
                </div>
                {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}
                <Button size="lg" className="w-full" disabled={phase === 'starting' || !user} onClick={() => void begin()}>
                  {phase === 'starting' ? 'Building your diagnostic…' : 'Begin Diagnostic'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  if (phase === 'submitting') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-lg font-semibold font-display">Grading and analysing your answers…</p>
        </div>
      </AppLayout>
    );
  }

  const question = questions[currentIndex];
  if (!question) return null;
  const options = optionList(question.options);
  const answeredCount = questions.filter((q, i) => q.answered_at || selectedAnswers[i]).length;
  const isLast = currentIndex === questions.length - 1;
  const locked = Boolean(question.answered_at);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Question {currentIndex + 1} of {questions.length}</span>
            <span className={cn('font-mono font-bold', timerPercent > 50 ? 'text-success' : timerPercent > 20 ? 'text-warning' : 'text-destructive')}>
              <Clock className="inline h-4 w-4 mr-1" />{formatTime(timeRemaining)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-1000', timerPercent > 50 ? 'bg-success' : timerPercent > 20 ? 'bg-warning' : 'bg-destructive')} style={{ width: `${timerPercent}%` }} />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {questions.map((q, i) => (
            <button key={q.question_id} onClick={() => goToQuestion(i)}
              className={cn('h-7 w-7 rounded-md text-xs font-medium transition-all',
                i === currentIndex ? 'bg-primary text-primary-foreground'
                  : q.answered_at || selectedAnswers[i] ? 'bg-success/20 text-success border border-success/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
              {i + 1}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-normal leading-relaxed">{question.stem}</CardTitle>
                {locked && <p className="text-xs text-muted-foreground">Already submitted.</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                {options.map((option, optIndex) => {
                  const letter = String.fromCharCode(65 + optIndex);
                  const isSelected = selectedAnswers[currentIndex] === letter;
                  return (
                    <button key={optIndex} disabled={locked} onClick={() => selectAnswer(letter)}
                      className={cn('w-full rounded-lg border p-4 text-left transition-all text-sm',
                        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/30 hover:bg-muted/50')}>
                      <span className={cn('mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{letter}</span>
                      {option.replace(/^[A-E]\.\s*/, '')}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => goToQuestion(currentIndex - 1)} disabled={currentIndex === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">{answeredCount}/{questions.length} answered</span>
          {!isLast ? (
            <Button onClick={() => goToQuestion(currentIndex + 1)} className="gap-1">Next <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={() => void handleSubmit()} className="gap-1" variant={answeredCount === questions.length ? 'default' : 'outline'}>
              <Lock className="h-4 w-4" /> Submit ({answeredCount}/{questions.length})
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
