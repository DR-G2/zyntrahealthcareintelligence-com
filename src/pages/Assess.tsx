import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
  difficulty: string;
}

const TOTAL_TIME_SECONDS = 20 * 60;
const QUESTION_COUNT = 20;

function getDifficultyForScore(score: number): string {
  if (score > 2) return 'hard';
  if (score < -2) return 'easy';
  return 'medium';
}

export default function Assess() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phase, setPhase] = useState<'intro' | 'test' | 'submitting'>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [answerChanges, setAnswerChanges] = useState<Record<number, number>>({});
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(TOTAL_TIME_SECONDS);
  const [loading, setLoading] = useState(true);
  const [adaptiveScore, setAdaptiveScore] = useState(0);
  const usedQuestionIds = useRef<Set<string>>(new Set());
  const questionPoolRef = useRef<Record<string, Question[]>>({ easy: [], medium: [], hard: [] });

  // Pre-fetch pools of each difficulty
  useEffect(() => {
    const fetchPools = async () => {
      const difficulties = ['easy', 'medium', 'hard'];
      const pools: Record<string, Question[]> = { easy: [], medium: [], hard: [] };

      const results = await Promise.all(
        difficulties.map(d =>
          supabase
            .from('questions')
            .select('id, question_text, options, correct_answer, explanation, category, difficulty')
            .eq('difficulty', d)
            .limit(50)
        )
      );

      results.forEach((res, i) => {
        if (res.data) {
          // Shuffle
          pools[difficulties[i]] = (res.data as Question[]).sort(() => Math.random() - 0.5);
        }
      });

      questionPoolRef.current = pools;

      // Start with first medium question
      const firstQ = pools.medium[0];
      if (!firstQ) {
        // Fallback: try any difficulty
        const fallback = [...pools.easy, ...pools.medium, ...pools.hard];
        if (!fallback.length) {
          toast({ title: 'Error', description: 'No questions available', variant: 'destructive' });
          setLoading(false);
          return;
        }
        setQuestions([fallback[0]]);
        usedQuestionIds.current.add(fallback[0].id);
      } else {
        setQuestions([firstQ]);
        usedQuestionIds.current.add(firstQ.id);
      }
      setLoading(false);
    };
    fetchPools();
  }, []);

  const getNextQuestion = useCallback((): Question | null => {
    const targetDifficulty = getDifficultyForScore(adaptiveScore);
    const pool = questionPoolRef.current[targetDifficulty];
    
    // Find unused question from target difficulty
    let next = pool.find(q => !usedQuestionIds.current.has(q.id));
    
    // Fallback to other difficulties
    if (!next) {
      const allPools = ['medium', 'easy', 'hard'];
      for (const d of allPools) {
        next = questionPoolRef.current[d].find(q => !usedQuestionIds.current.has(q.id));
        if (next) break;
      }
    }
    
    if (next) usedQuestionIds.current.add(next.id);
    return next || null;
  }, [adaptiveScore]);

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
    const prevAnswer = selectedAnswers[currentIndex];
    if (prevAnswer && prevAnswer !== answer) {
      setAnswerChanges((prev) => ({
        ...prev,
        [currentIndex]: (prev[currentIndex] || 0) + 1,
      }));
    }

    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: answer }));

    // Update adaptive score when answering
    if (!prevAnswer) {
      const question = questions[currentIndex];
      if (question) {
        const isCorrect = answer === question.correct_answer;
        setAdaptiveScore(prev => prev + (isCorrect ? 1 : -1));
      }
    }
  };

  const goToQuestion = (index: number) => {
    recordQuestionTime();

    // If moving forward and we need a new question
    if (index >= questions.length && questions.length < QUESTION_COUNT) {
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
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      goToQuestion(currentIndex + 1);
    } else if (questions.length < QUESTION_COUNT) {
      goToQuestion(questions.length); // triggers new question fetch
    }
  };

  const handleSubmit = async () => {
    if (phase === 'submitting') return;
    setPhase('submitting');
    recordQuestionTime();

    const attempts = questions.map((q, i) => ({
      questionId: q.id,
      selectedAnswer: selectedAnswers[i] || '',
      timeTaken: questionTimes[i] || 0,
      answerChanges: answerChanges[i] || 0,
      isCorrect: selectedAnswers[i] === q.correct_answer,
    }));

    const totalCorrect = attempts.filter((a) => a.isCorrect).length;
    const totalAnswered = attempts.filter((a) => a.selectedAnswer).length;
    const totalChanges = attempts.reduce((sum, a) => sum + a.answerChanges, 0);
    const avgTime = attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length;

    const stabilityScore = Math.max(0, 100 - (totalChanges / attempts.length) * 50);
    const clinicalAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;
    const timeSensitivity = Math.max(0, 100 - Math.max(0, avgTime - 60) * 2);
    const confidenceGap = Math.abs(70 - clinicalAccuracy);
    const readinessScore = (stabilityScore * 0.2 + timeSensitivity * 0.2 + (100 - confidenceGap) * 0.2 + clinicalAccuracy * 0.4);

    navigate('/profile', {
      state: {
        performanceData: {
          stability_score: Math.round(stabilityScore),
          time_sensitivity: Math.round(timeSensitivity),
          confidence_gap: Math.round(confidenceGap),
          clinical_accuracy: Math.round(clinicalAccuracy),
          readiness_score: Math.round(readinessScore),
        },
      },
    });
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
                      <span>We track <strong>answer changes</strong> — choose carefully, but you can revise</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" />
                      <span>Your <strong>Performance Profile</strong> will be generated after</span>
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Questions adapt to your performance — get them right and they get harder.
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setPhase('test');
                    setQuestionStartTime(Date.now());
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        {/* Timer bar */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Question {currentIndex + 1} of {QUESTION_COUNT}
              <span className="ml-2 text-xs opacity-60">({question.difficulty})</span>
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
            <div
              className={cn('h-full rounded-full transition-all duration-1000', timerColor)}
              style={{ width: `${timerPercent}%` }}
            />
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
                  {(answerChanges[currentIndex] || 0) > 0 && (
                    <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                      {answerChanges[currentIndex]} change{answerChanges[currentIndex] > 1 ? 's' : ''}
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
          <Button
            variant="ghost"
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="gap-1"
          >
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
            <Button
              onClick={handleSubmit}
              className="gap-1"
              variant={answeredCount === QUESTION_COUNT ? 'default' : 'outline'}
            >
              <Lock className="h-4 w-4" />
              Submit ({answeredCount}/{QUESTION_COUNT})
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
