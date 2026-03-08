import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, Lock, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { selectNextQuestion, shouldShowIntervention, type SequencingState, type QuestionWithTier } from '@/lib/sequencing';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
  difficulty: string;
  difficulty_tier: number | null;
}

const TOTAL_TIME_SECONDS = 20 * 60;
const QUESTION_COUNT = 20;

export default function Assess() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const sessionIdRef = useRef(crypto.randomUUID());

  const [phase, setPhase] = useState<'intro' | 'test' | 'submitting'>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [changeSequences, setChangeSequences] = useState<Record<number, string[]>>({});
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [questionLoadTime, setQuestionLoadTime] = useState<number>(Date.now());
  const [firstClickRecorded, setFirstClickRecorded] = useState<Record<number, boolean>>({});
  const [timeToFirstClick, setTimeToFirstClick] = useState<Record<number, number>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [pauseEvents, setPauseEvents] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(TOTAL_TIME_SECONDS);
  const [loading, setLoading] = useState(true);
  const [intervention, setIntervention] = useState<string | null>(null);

  // Sequencing state
  const sequencingRef = useRef<SequencingState>({
    position: 0,
    consecutiveIncorrect: 0,
    consecutiveSameSubject: 0,
    lastSubject: null,
    recentResults: [],
    recentChanges: [],
    avgTimePerQuestion: 0,
    initialAvgTime: 0,
  });
  const usedQuestionIds = useRef<Set<string>>(new Set());
  const questionPoolRef = useRef<QuestionWithTier[]>([]);
  const lastInteractionRef = useRef(Date.now());
  const pauseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch question pool with tiers
  useEffect(() => {
    const fetchPool = async () => {
      // Fetch difficulty-balanced pool: 50% hard, 30% medium, 20% easy
      const [hardRes, mediumRes, easyRes] = await Promise.all([
        supabase.from('questions')
          .select('id, question_text, options, correct_answer, explanation, category, difficulty, difficulty_tier')
          .eq('difficulty', 'hard').limit(50),
        supabase.from('questions')
          .select('id, question_text, options, correct_answer, explanation, category, difficulty, difficulty_tier')
          .eq('difficulty', 'medium').limit(30),
        supabase.from('questions')
          .select('id, question_text, options, correct_answer, explanation, category, difficulty, difficulty_tier')
          .eq('difficulty', 'easy').limit(20),
      ]);

      const pool = [
        ...(hardRes.data || []),
        ...(mediumRes.data || []),
        ...(easyRes.data || []),
      ];

      if (pool.length === 0) {
        toast({ title: 'Error', description: 'No questions available', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Shuffle the combined pool
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      questionPoolRef.current = pool as QuestionWithTier[];

      const firstQ = selectNextQuestion(
        questionPoolRef.current,
        usedQuestionIds.current,
        sequencingRef.current,
        QUESTION_COUNT
      );

      if (firstQ) {
        setQuestions([firstQ as unknown as Question]);
        usedQuestionIds.current.add(firstQ.id);
      }
      setLoading(false);
    };
    fetchPool();
  }, []);

  // Pause detection timer
  useEffect(() => {
    if (phase !== 'test') return;
    pauseTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastInteractionRef.current) / 1000;
      if (elapsed > 10) {
        setPauseEvents(prev => ({ ...prev, [currentIndex]: (prev[currentIndex] || 0) + 1 }));
        lastInteractionRef.current = Date.now(); // reset to avoid counting same pause
      }
    }, 5000);
    return () => { if (pauseTimerRef.current) clearInterval(pauseTimerRef.current); };
  }, [phase, currentIndex]);

  const getNextQuestion = useCallback((): Question | null => {
    const next = selectNextQuestion(
      questionPoolRef.current,
      usedQuestionIds.current,
      sequencingRef.current,
      QUESTION_COUNT
    );
    if (next) {
      usedQuestionIds.current.add(next.id);
      return next as unknown as Question;
    }
    return null;
  }, []);

  useEffect(() => {
    if (phase !== 'test') return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const timerPercent = (timeRemaining / TOTAL_TIME_SECONDS) * 100;
  const timerColor = timerPercent > 50 ? 'bg-success' : timerPercent > 20 ? 'bg-warning' : 'bg-destructive';

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const recordQuestionTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setQuestionTimes((prev) => ({
      ...prev,
      [currentIndex]: (prev[currentIndex] || 0) + elapsed,
    }));
  }, [currentIndex, questionStartTime]);

  const selectAnswer = (answer: string) => {
    lastInteractionRef.current = Date.now();

    // Track first click time
    if (!firstClickRecorded[currentIndex]) {
      const delta = Math.round((Date.now() - questionLoadTime) / 1000);
      setTimeToFirstClick(prev => ({ ...prev, [currentIndex]: delta }));
      setFirstClickRecorded(prev => ({ ...prev, [currentIndex]: true }));
    }

    // Track change sequence
    setChangeSequences(prev => {
      const seq = prev[currentIndex] || [];
      return { ...prev, [currentIndex]: [...seq, answer] };
    });

    const prevAnswer = selectedAnswers[currentIndex];

    // Update adaptive sequencing
    if (!prevAnswer) {
      const question = questions[currentIndex];
      if (question) {
        const isCorrect = answer === question.correct_answer;
        const state = sequencingRef.current;
        state.recentResults = [...state.recentResults.slice(-4), isCorrect];
        state.consecutiveIncorrect = isCorrect ? 0 : state.consecutiveIncorrect + 1;
        state.consecutiveSameSubject = question.category === state.lastSubject ? state.consecutiveSameSubject + 1 : 1;
        state.lastSubject = question.category;
      }
    }

    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: answer }));

    // Track changes for interventions
    if (prevAnswer && prevAnswer !== answer) {
      const changes = changeSequences[currentIndex]?.length || 0;
      sequencingRef.current.recentChanges = [...sequencingRef.current.recentChanges.slice(-4), changes];
    }

    // Check for interventions
    const interventionType = shouldShowIntervention(sequencingRef.current);
    if (interventionType && !intervention) {
      setIntervention(interventionType);
      setTimeout(() => setIntervention(null), 5000);
    }
  };

  const goToQuestion = (index: number) => {
    recordQuestionTime();
    lastInteractionRef.current = Date.now();

    if (index >= questions.length && questions.length < QUESTION_COUNT) {
      sequencingRef.current.position = questions.length;
      const next = getNextQuestion();
      if (next) {
        setQuestions(prev => [...prev, next]);
      } else {
        toast({ title: 'No more questions', description: 'Question pool exhausted' });
        return;
      }
    }

    if (index >= 0 && index < Math.min(questions.length, QUESTION_COUNT)) {
      setCurrentIndex(index);
      setQuestionStartTime(Date.now());
      setQuestionLoadTime(Date.now());
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1);
    } else if (questions.length < QUESTION_COUNT) {
      goToQuestion(questions.length);
    }
  };

  const handleSubmit = async () => {
    if (phase === 'submitting') return;
    setPhase('submitting');
    recordQuestionTime();

    const inserts = questions.map((q, i) => ({
      user_id: user!.id,
      question_id: q.id,
      selected_answer: selectedAnswers[i] || '',
      time_taken_seconds: questionTimes[i] || 0,
      answer_changes_count: (changeSequences[i]?.length || 1) - 1,
      is_correct: selectedAnswers[i] === q.correct_answer,
      session_id: sessionIdRef.current,
      time_to_first_click: timeToFirstClick[i] || 0,
      change_sequence: changeSequences[i] || [],
      pause_events: pauseEvents[i] || 0,
      time_of_day: new Date().toISOString(),
      question_position: i,
      previous_question_correct: i > 0 ? (selectedAnswers[i - 1] === questions[i - 1]?.correct_answer) : null,
    }));

    if (user) {
      await supabase.from('user_attempts').insert(inserts);

      // Compute performance data
      const totalCorrect = inserts.filter(a => a.is_correct).length;
      const totalAnswered = inserts.filter(a => a.selected_answer).length;
      const totalChanges = inserts.reduce((sum, a) => sum + a.answer_changes_count, 0);
      const avgTime = inserts.reduce((sum, a) => sum + a.time_taken_seconds, 0) / inserts.length;

      const stabilityScore = Math.max(0, 100 - (totalChanges / inserts.length) * 50);
      const clinicalAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;
      const timeSensitivity = Math.max(0, 100 - Math.max(0, avgTime - 60) * 2);
      const confidenceGap = Math.abs(70 - clinicalAccuracy);
      const readinessScore = stabilityScore * 0.2 + timeSensitivity * 0.2 + (100 - confidenceGap) * 0.2 + clinicalAccuracy * 0.4;

      const performanceData = {
        stability_score: Math.round(stabilityScore),
        time_sensitivity: Math.round(timeSensitivity),
        confidence_gap: Math.round(confidenceGap),
        clinical_accuracy: Math.round(clinicalAccuracy),
        readiness_score: Math.round(readinessScore),
      };

      const { data: existing } = await supabase.from('performance_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (existing) {
        await supabase.from('performance_profiles').update({
          clinical_accuracy: Math.round(((existing.clinical_accuracy || 0) * 0.4 + performanceData.clinical_accuracy * 0.6) * 10) / 10,
          stability_score: Math.round(((existing.stability_score || 0) * 0.4 + performanceData.stability_score * 0.6) * 10) / 10,
          time_sensitivity: Math.round(((existing.time_sensitivity || 0) * 0.4 + performanceData.time_sensitivity * 0.6) * 10) / 10,
          confidence_gap: Math.round(((existing.confidence_gap || 0) * 0.4 + performanceData.confidence_gap * 0.6) * 10) / 10,
          readiness_score: Math.round(((existing.readiness_score || 0) * 0.4 + performanceData.readiness_score * 0.6) * 10) / 10,
        }).eq('user_id', user.id);
      } else {
        await supabase.from('performance_profiles').insert({ user_id: user.id, ...performanceData });
      }

      // Trigger behavior analysis in background
      supabase.functions.invoke('analyze-behavior').catch(console.error);
    }

    navigate('/profile', { state: { performanceData: { stability_score: Math.round(Math.max(0, 100 - (inserts.reduce((s, a) => s + a.answer_changes_count, 0) / inserts.length) * 50)) } } });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (phase === 'intro') {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <AlertTriangle className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl font-display">APPE Diagnostic Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-muted p-4 space-y-3">
                  <p className="font-medium">What to expect:</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5 text-primary" />
                      <span><strong>{QUESTION_COUNT} questions</strong> in {TOTAL_TIME_SECONDS / 60} minutes — <strong>adaptive difficulty</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lock className="h-4 w-4 mt-0.5 text-primary" />
                      <span>We track <strong>answer changes, timing, and pauses</strong> — choose carefully</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" />
                      <span>Your <strong>Behavior Profile</strong> will be generated after</span>
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Questions adapt using smart sequencing — difficulty escalates based on your performance.
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setPhase('test');
                    setQuestionStartTime(Date.now());
                    setQuestionLoadTime(Date.now());
                  }}
                >
                  Begin Diagnostic
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
          <p className="text-muted-foreground">Analyzing your performance...</p>
        </div>
      </AppLayout>
    );
  }

  const question = questions[currentIndex];
  if (!question) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-muted-foreground">No questions available. Please try again later.</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </AppLayout>
    );
  }

  const options = question.options as string[];
  const answeredCount = Object.keys(selectedAnswers).length;
  const isLastQuestion = questions.length >= QUESTION_COUNT && currentIndex === questions.length - 1;
  const answerChanges = changeSequences[currentIndex] ? Math.max(0, changeSequences[currentIndex].length - 1) : 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        {/* Intervention toast */}
        {intervention && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"
          >
            <Lightbulb className="h-4 w-4 text-warning shrink-0" />
            {intervention === 'trust_your_gut' && (
              <span>💡 <strong>Trust Your Gut</strong> — Data shows your first instinct is often correct. Try committing to your initial choice.</span>
            )}
            {intervention === 'review_mode' && (
              <span>📚 <strong>Take a breath</strong> — You've had a few tough ones. The next questions will be more approachable.</span>
            )}
          </motion.div>
        )}

        {/* Timer bar */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Question {currentIndex + 1} of {QUESTION_COUNT}
              {question.difficulty_tier && (
                <span className="ml-2 text-xs opacity-60">(Tier {question.difficulty_tier})</span>
              )}
            </span>
            <span className={cn(
              'font-mono font-bold',
              timerPercent > 50 ? 'text-success' : timerPercent > 20 ? 'text-warning' : 'text-destructive'
            )}>
              <Clock className="inline h-4 w-4 mr-1" />
              {formatTime(timeRemaining)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-1000', timerColor)} style={{ width: `${timerPercent}%` }} />
          </div>
        </div>

        {/* Question navigator dots */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {Array.from({ length: Math.max(questions.length, QUESTION_COUNT) }, (_, i) => (
            <button
              key={i}
              onClick={() => i < questions.length && goToQuestion(i)}
              disabled={i >= questions.length}
              className={cn(
                'h-7 w-7 rounded-md text-xs font-medium transition-all',
                i === currentIndex
                  ? 'bg-primary text-primary-foreground'
                  : i < questions.length && selectedAnswers[i]
                  ? 'bg-success/20 text-success border border-success/30'
                  : i < questions.length
                  ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                  : 'bg-muted/40 text-muted-foreground/30'
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {question.category}
                  </span>
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    question.difficulty === 'easy' ? 'bg-success/10 text-success' :
                    question.difficulty === 'hard' ? 'bg-destructive/10 text-destructive' :
                    'bg-warning/10 text-warning'
                  )}>
                    {question.difficulty}
                  </span>
                  {answerChanges > 0 && (
                    <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                      {answerChanges} change{answerChanges > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg font-normal leading-relaxed">
                  {question.question_text}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {options.map((option, optIndex) => {
                  const letter = String.fromCharCode(65 + optIndex);
                  const isSelected = selectedAnswers[currentIndex] === letter;
                  return (
                    <button
                      key={optIndex}
                      onClick={() => selectAnswer(letter)}
                      className={cn(
                        'w-full rounded-lg border p-4 text-left transition-all text-sm',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      )}
                    >
                      <span className={cn(
                        'mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}>
                        {letter}
                      </span>
                      {option.replace(/^[A-E]\.\s*/, '')}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => goToQuestion(currentIndex - 1)} disabled={currentIndex === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            {answeredCount}/{QUESTION_COUNT} answered
          </span>

          {!isLastQuestion ? (
            <Button onClick={handleNext} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="gap-1" variant={answeredCount === QUESTION_COUNT ? 'default' : 'outline'}>
              <Lock className="h-4 w-4" />
              Submit ({answeredCount}/{QUESTION_COUNT})
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
