import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Lock, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { QuestionExplanation } from '@/components/practice/QuestionExplanation';
import { Progress } from '@/components/ui/progress';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
  diagnosis_explanation?: string | null;
  first_line_investigation?: string | null;
  gold_standard_investigation?: string | null;
  best_treatment?: string | null;
  differential_diagnoses?: any[] | null;
  incorrect_answer_explanations?: Record<string, any> | null;
  key_takeaways?: string[] | null;
}

interface SessionConfig {
  mode: 'recharge' | 'no-change';
  topics: string[];
  questionCount: number;
}

// ─── Setup Screen ───────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (config: SessionConfig) => void }) {
  const [mode, setMode] = useState<'recharge' | 'no-change'>('recharge');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState('10');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('questions').select('category');
      if (data) {
        const unique = [...new Set(data.map((d) => d.category))].sort();
        setCategories(unique);
        setSelectedTopics(unique); // default: all selected
      }
      setLoading(false);
    };
    fetchCategories();
  }, []);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const toggleAll = () => {
    setSelectedTopics(selectedTopics.length === categories.length ? [] : [...categories]);
  };

  const canStart = selectedTopics.length > 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Practice Drills</h1>
          <p className="text-muted-foreground">Configure your session and start practising</p>
        </div>

        {/* Mode Selection */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Mode</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => setMode('recharge')}
              className={cn(
                'rounded-xl border-2 p-5 text-left transition-all',
                mode === 'recharge'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <span className="font-display font-semibold">Recharge Answer</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Change your answer as many times as you want before moving to the next question.
              </p>
            </button>

            <button
              onClick={() => setMode('no-change')}
              className={cn(
                'rounded-xl border-2 p-5 text-left transition-all',
                mode === 'no-change'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4">
                  <Lock className="h-5 w-5" />
                </div>
                <span className="font-display font-semibold">No Change</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Once you select an answer, it locks immediately. No going back.
              </p>
            </button>
          </div>
        </div>

        {/* Question Count */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Number of Questions</h2>
          <Select value={questionCount} onValueChange={setQuestionCount}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['10', '20', '30', '50'].map((n) => (
                <SelectItem key={n} value={n}>
                  {n} questions · {n} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Topic Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topics</h2>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selectedTopics.length === categories.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.map((cat) => (
              <label
                key={cat}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors',
                  selectedTopics.includes(cat)
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-primary/20'
                )}
              >
                <Checkbox
                  checked={selectedTopics.includes(cat)}
                  onCheckedChange={() => toggleTopic(cat)}
                />
                <span className="truncate">{cat}</span>
              </label>
            ))}
          </div>
          {selectedTopics.length === 0 && (
            <p className="text-sm text-destructive">Select at least one topic</p>
          )}
        </div>

        {/* Start Button */}
        <Button
          size="lg"
          disabled={!canStart}
          onClick={() => onStart({ mode, topics: selectedTopics, questionCount: parseInt(questionCount) })}
          className="w-full sm:w-auto gap-2"
        >
          <Zap className="h-4 w-4" /> Start Drill
        </Button>
      </div>
    </AppLayout>
  );
}

// ─── Drill Session ──────────────────────────────────────────────

function DrillSession({
  config,
  onFinish,
}: {
  config: SessionConfig;
  onFinish: (questions: Question[], answers: Record<number, string>, changes: Record<number, number>, times: Record<number, number>) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const canChangeAnswer = config.mode === 'recharge';
  const timeSeconds = config.questionCount * 60;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [lockedAnswers, setLockedAnswers] = useState<Record<number, boolean>>({});
  const [answerChanges, setAnswerChanges] = useState<Record<number, number>>({});
  const [changeSequences, setChangeSequences] = useState<Record<number, string[]>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [questionLoadTime, setQuestionLoadTime] = useState(Date.now());
  const [firstClickRecorded, setFirstClickRecorded] = useState<Record<number, boolean>>({});
  const [timeToFirstClick, setTimeToFirstClick] = useState<Record<number, number>>({});
  const [pauseEvents, setPauseEvents] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(timeSeconds);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const sessionIdRef = useRef(crypto.randomUUID());
  const lastInteractionRef = useRef(Date.now());
  const pauseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchQ = async () => {
      const { data } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_answer, explanation, category, diagnosis_explanation, first_line_investigation, gold_standard_investigation, best_treatment, differential_diagnoses, incorrect_answer_explanations, key_takeaways')
        .in('category', config.topics)
        .limit(200);
      if (data) {
        const shuffled = data.sort(() => Math.random() - 0.5).slice(0, config.questionCount);
        setQuestions(shuffled as Question[]);
      }
      setLoading(false);
    };
    fetchQ();
  }, []);

  // Pause detection
  useEffect(() => {
    if (loading || finished) return;
    pauseTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastInteractionRef.current) / 1000;
      if (elapsed > 10) {
        setPauseEvents(prev => ({ ...prev, [currentIndex]: (prev[currentIndex] || 0) + 1 }));
        lastInteractionRef.current = Date.now();
      }
    }, 5000);
    return () => { if (pauseTimerRef.current) clearInterval(pauseTimerRef.current); };
  }, [loading, finished, currentIndex]);

  useEffect(() => {
    if (loading || finished) return;
    const interval = setInterval(() => {
      setTimeRemaining((p) => {
        if (p <= 1) {
          clearInterval(interval);
          doFinish();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, finished]);

  const recordTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setQuestionTimes((p) => ({ ...p, [currentIndex]: (p[currentIndex] || 0) + elapsed }));
  }, [currentIndex, questionStartTime]);

  const selectAnswer = (answer: string) => {
    if (lockedAnswers[currentIndex]) return;
    lastInteractionRef.current = Date.now();

    // Track first click
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

    if (selectedAnswers[currentIndex] && selectedAnswers[currentIndex] !== answer) {
      setAnswerChanges((p) => ({ ...p, [currentIndex]: (p[currentIndex] || 0) + 1 }));
    }
    setSelectedAnswers((p) => ({ ...p, [currentIndex]: answer }));
    if (!canChangeAnswer) {
      setLockedAnswers((p) => ({ ...p, [currentIndex]: true }));
    }
  };

  const goTo = (i: number) => {
    recordTime();
    lastInteractionRef.current = Date.now();
    setCurrentIndex(i);
    setQuestionStartTime(Date.now());
    setQuestionLoadTime(Date.now());
  };

  const doFinish = async () => {
    if (finished) return;
    setFinished(true);
    recordTime();

    // Save attempts with enhanced tracking
    if (user && questions.length > 0) {
      const inserts = questions.map((q, i) => ({
        user_id: user.id,
        question_id: q.id,
        selected_answer: selectedAnswers[i] || '',
        time_taken_seconds: questionTimes[i] || 0,
        answer_changes_count: answerChanges[i] || 0,
        is_correct: selectedAnswers[i] === q.correct_answer,
        session_id: sessionIdRef.current,
        time_to_first_click: timeToFirstClick[i] || 0,
        change_sequence: changeSequences[i] || [],
        pause_events: pauseEvents[i] || 0,
        time_of_day: new Date().toISOString(),
        question_position: i,
        previous_question_correct: i > 0 ? (selectedAnswers[i - 1] === questions[i - 1]?.correct_answer) : null,
      }));
      await supabase.from('user_attempts').insert(inserts);

      // Trigger behavior analysis in background
      supabase.functions.invoke('analyze-behavior').catch(console.error);
    }

    onFinish(questions, selectedAnswers, answerChanges, questionTimes);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerPercent = (timeRemaining / timeSeconds) * 100;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const question = questions[currentIndex];
  if (!question) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <p className="text-muted-foreground">No questions found for the selected topics. Try selecting more topics.</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  const options = question.options as string[];

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        {/* Timer bar */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Q{currentIndex + 1}/{questions.length}</span>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {config.mode === 'recharge' ? <><RefreshCw className="h-3 w-3 mr-1" />Recharge</> : <><Lock className="h-3 w-3 mr-1" />No Change</>}
              </Badge>
              <span className={cn('font-mono font-bold', timerPercent > 50 ? 'text-success' : timerPercent > 20 ? 'text-warning' : 'text-destructive')}>
                <Clock className="inline h-4 w-4 mr-1" />{formatTime(timeRemaining)}
              </span>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', timerPercent > 50 ? 'bg-success' : timerPercent > 20 ? 'bg-warning' : 'bg-destructive')} style={{ width: `${timerPercent}%` }} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
            <Card>
              <CardHeader>
                <span className="text-xs text-primary font-medium">{question.category}</span>
                <CardTitle className="text-lg font-normal leading-relaxed">{question.question_text}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {options.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi);
                  const isSelected = selectedAnswers[currentIndex] === letter;
                  const isLocked = lockedAnswers[currentIndex];
                  return (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(letter)}
                      disabled={isLocked && !isSelected}
                      className={cn(
                        'w-full rounded-lg border p-4 text-left text-sm transition-all',
                        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/30',
                        isLocked && !isSelected && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <span className={cn('mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        {letter}
                      </span>
                      {opt.replace(/^[A-E]\.\s*/, '')}
                      {isLocked && isSelected && <Lock className="inline h-3 w-3 ml-2 text-primary" />}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          {currentIndex < questions.length - 1 ? (
            <Button onClick={() => goTo(currentIndex + 1)} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={doFinish} className="gap-1">
              <Lock className="h-4 w-4" /> Finish
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Results Screen ─────────────────────────────────────────────

function ResultsScreen({
  questions,
  answers,
  changes,
  config,
}: {
  questions: Question[];
  answers: Record<number, string>;
  changes: Record<number, number>;
  config: SessionConfig;
}) {
  const { user } = useAuth();
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [dnaUpdated, setDnaUpdated] = useState(false);

  // Compute per-category stats
  const categoryStats: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q, i) => {
    if (!categoryStats[q.category]) categoryStats[q.category] = { correct: 0, total: 0 };
    categoryStats[q.category].total++;
    if (answers[i] === q.correct_answer) categoryStats[q.category].correct++;
  });

  const correct = questions.filter((q, i) => answers[i] === q.correct_answer).length;
  const total = questions.length;
  const overallAccuracy = total > 0 ? correct / total : 0;

  const strengths = Object.entries(categoryStats).filter(([, s]) => s.total >= 1 && s.correct / s.total >= 0.8).map(([c]) => c);
  const weaknesses = Object.entries(categoryStats).filter(([, s]) => s.total >= 1 && s.correct / s.total < 0.6).map(([c]) => c);

  // Update Performance DNA
  useEffect(() => {
    if (!user || dnaUpdated) return;
    setDnaUpdated(true);

    const updateDNA = async () => {
      // Stability: ratio of questions with 0 changes (only meaningful in recharge mode)
      const totalChanges = Object.values(changes).reduce((a, b) => a + b, 0);
      const stabilityScore = config.mode === 'recharge' ? Math.max(0, 100 - (totalChanges / total) * 50) : null;

      // Confidence gap: difference between best and worst category accuracy
      const accuracies = Object.values(categoryStats).map((s) => s.correct / s.total);
      const confidenceGap = accuracies.length > 1 ? Math.max(...accuracies) - Math.min(...accuracies) : 0;

      // Upsert performance_profiles
      const { data: existing } = await supabase
        .from('performance_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const blendedAccuracy = (existing.clinical_accuracy || 0) * 0.6 + overallAccuracy * 100 * 0.4;
        const updateData: Record<string, any> = {
          clinical_accuracy: Math.round(blendedAccuracy * 10) / 10,
          confidence_gap: Math.round(confidenceGap * 100) / 100,
        };
        if (stabilityScore !== null) {
          const blendedStability = ((existing.stability_score || 0) * 0.6 + stabilityScore * 0.4);
          updateData.stability_score = Math.round(blendedStability * 10) / 10;
        }
        await supabase.from('performance_profiles').update(updateData).eq('user_id', user.id);
      } else {
        await supabase.from('performance_profiles').insert({
          user_id: user.id,
          clinical_accuracy: Math.round(overallAccuracy * 1000) / 10,
          stability_score: stabilityScore !== null ? Math.round(stabilityScore * 10) / 10 : 0,
          confidence_gap: Math.round(confidenceGap * 100) / 100,
        });
      }

      // Update weak_areas on profile
      if (weaknesses.length > 0) {
        await supabase.from('profiles').update({ weak_areas: weaknesses }).eq('id', user.id);
      }
    };

    updateDNA();
  }, [user]);

  if (reviewIndex !== null) {
    const q = questions[reviewIndex];
    return (
      <AppLayout>
        <AnimatePresence mode="wait">
          <QuestionExplanation
            key={reviewIndex}
            question={q}
            userAnswer={answers[reviewIndex]}
            questionIndex={reviewIndex}
            onBack={() => setReviewIndex(null)}
          />
        </AnimatePresence>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl py-12 space-y-8">
        {/* Score */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">Drill Complete!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-5xl font-bold font-display text-primary">{correct}/{total}</div>
            <p className="text-muted-foreground">{Math.round(overallAccuracy * 100)}% accuracy</p>
            <Badge variant="outline">
              {config.mode === 'recharge' ? <><RefreshCw className="h-3 w-3 mr-1" />Recharge Mode</> : <><Lock className="h-3 w-3 mr-1" />No Change Mode</>}
            </Badge>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Performance by Topic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(categoryStats)
              .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
              .map(([cat, stats]) => {
                const pct = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{cat}</span>
                      <span className={cn('font-mono text-xs font-semibold', pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive')}>
                        {stats.correct}/{stats.total} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* Strengths / Weaknesses */}
        {(strengths.length > 0 || weaknesses.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {strengths.length > 0 && (
              <Card className="border-l-4 border-l-success">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <CardTitle className="text-sm font-display">Strengths</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {strengths.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs border-success/30 text-success">{s}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {weaknesses.length > 0 && (
              <Card className="border-l-4 border-l-destructive">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <CardTitle className="text-sm font-display">Needs Work</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {weaknesses.map((w) => (
                      <Badge key={w} variant="outline" className="text-xs border-destructive/30 text-destructive">{w}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>More Drills</Button>
          <Button asChild><a href="/profile">View Profile</a></Button>
        </div>

        {/* Review Questions */}
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold">Review Questions</h2>
          {questions.map((q, i) => {
            const userAnswer = answers[i];
            const isCorrect = userAnswer === q.correct_answer;
            return (
              <Card
                key={q.id}
                className={cn('border-l-4 cursor-pointer hover:shadow-md transition-shadow', isCorrect ? 'border-l-success' : 'border-l-destructive')}
                onClick={() => setReviewIndex(i)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1 line-clamp-2">{q.question_text}</p>
                      <p className="text-xs text-muted-foreground">
                        Your answer: <strong>{userAnswer || 'Not answered'}</strong> · Correct: <strong>{q.correct_answer}</strong>
                      </p>
                    </div>
                    <Badge className={cn('shrink-0', isCorrect ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
                      {isCorrect ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      {isCorrect ? 'Correct' : 'Wrong'}
                    </Badge>
                  </div>
                  <p className="text-xs text-primary mt-2 font-medium">Click to read full explanation →</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Main Practice Component ────────────────────────────────────

export default function Practice() {
  const [phase, setPhase] = useState<'setup' | 'drill' | 'results'>('setup');
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [resultData, setResultData] = useState<{
    questions: Question[];
    answers: Record<number, string>;
    changes: Record<number, number>;
  } | null>(null);

  if (phase === 'setup') {
    return (
      <SetupScreen
        onStart={(cfg) => {
          setConfig(cfg);
          setPhase('drill');
        }}
      />
    );
  }

  if (phase === 'drill' && config) {
    return (
      <DrillSession
        config={config}
        onFinish={(questions, answers, changes) => {
          setResultData({ questions, answers, changes });
          setPhase('results');
        }}
      />
    );
  }

  if (phase === 'results' && resultData && config) {
    return (
      <ResultsScreen
        questions={resultData.questions}
        answers={resultData.answers}
        changes={resultData.changes}
        config={config}
      />
    );
  }

  return null;
}
