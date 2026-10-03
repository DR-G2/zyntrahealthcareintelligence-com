import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingDown, 
  Brain, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  Clock,
  Zap,
  Award,
  Play,
  RotateCcw,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { XAxis, YAxis, AreaChart, Area } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';

interface AttemptWithQuestion {
  id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  answer_changes_count: number;
  change_sequence: string[];
  created_at: string;
  session_id: string;
  questions: {
    correct_answer: string;
    category: string;
  };
}

interface ChangeAnalysis {
  correctToWrong: number;
  wrongToCorrect: number;
  wrongToWrong: number;
  total: number;
}

interface CategoryBreakdown {
  category: string;
  pointsLost: number;
  changeRate: number;
  attempts: number;
}

export default function TrustYourGut() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [trainingMode, setTrainingMode] = useState(false);
  const [trainingQuestions, setTrainingQuestions] = useState<any[]>([]);
  const [currentTrainingIndex, setCurrentTrainingIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [decisionTimer, setDecisionTimer] = useState(3);
  const [showFeedback, setShowFeedback] = useState(false);
  const [trainingResults, setTrainingResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

  // Fetch user attempts with questions
  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['trust-gut-attempts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_attempts')
        .select('id, question_id, selected_answer, is_correct, answer_changes_count, change_sequence, created_at, session_id, questions(correct_answer, category)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(a => ({
        ...a,
        change_sequence: Array.isArray(a.change_sequence) ? a.change_sequence : [],
        questions: a.questions || { correct_answer: '', category: '' }
      })) as AttemptWithQuestion[];
    },
    enabled: !!user
  });

  // Fetch questions for training mode
  const { data: allQuestions = [] } = useQuery({
    queryKey: ['training-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_answer, category')
        .limit(100);
      if (error) throw error;
      return data || [];
    }
  });

  // Compute stats
  const stats = useMemo(() => {
    const attemptsWithChanges = attempts.filter(a => a.answer_changes_count > 0 && a.change_sequence.length > 0);
    
    let firstInstinctCorrect = 0;
    let finalCorrect = 0;
    let correctToWrong = 0;
    let wrongToCorrect = 0;
    let wrongToWrong = 0;
    
    attemptsWithChanges.forEach(a => {
      const firstAnswer = a.change_sequence[0];
      const correctAnswer = a.questions?.correct_answer;
      const finalAnswer = a.selected_answer;
      
      if (firstAnswer === correctAnswer) firstInstinctCorrect++;
      if (finalAnswer === correctAnswer) finalCorrect++;
      
      const firstWasCorrect = firstAnswer === correctAnswer;
      const finalIsCorrect = finalAnswer === correctAnswer;
      
      if (firstWasCorrect && !finalIsCorrect) correctToWrong++;
      else if (!firstWasCorrect && finalIsCorrect) wrongToCorrect++;
      else if (!firstWasCorrect && !finalIsCorrect && firstAnswer !== finalAnswer) wrongToWrong++;
    });

    const firstInstinctAccuracy = attemptsWithChanges.length > 0 
      ? (firstInstinctCorrect / attemptsWithChanges.length) * 100 
      : 0;
    const finalAccuracy = attemptsWithChanges.length > 0 
      ? (finalCorrect / attemptsWithChanges.length) * 100 
      : 0;

    // Overall stats
    const totalAttempts = attempts.length;
    const attemptsWithChangesCount = attemptsWithChanges.length;
    const changeRate = totalAttempts > 0 ? (attemptsWithChangesCount / totalAttempts) * 100 : 0;

    return {
      firstInstinctAccuracy,
      finalAccuracy,
      pointsLost: correctToWrong,
      pointsGained: wrongToCorrect,
      changeRate,
      totalWithChanges: attemptsWithChangesCount,
      totalAttempts,
      changeAnalysis: {
        correctToWrong,
        wrongToCorrect,
        wrongToWrong,
        total: attemptsWithChangesCount
      } as ChangeAnalysis
    };
  }, [attempts]);

  // Category breakdown
  const categoryBreakdown = useMemo((): CategoryBreakdown[] => {
    const categoryMap = new Map<string, { pointsLost: number; changes: number; attempts: number }>();
    
    attempts.forEach(a => {
      const category = a.questions?.category || 'Unknown';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { pointsLost: 0, changes: 0, attempts: 0 });
      }
      const entry = categoryMap.get(category)!;
      entry.attempts++;
      
      if (a.answer_changes_count > 0 && a.change_sequence.length > 0) {
        entry.changes++;
        const firstAnswer = a.change_sequence[0];
        const correctAnswer = a.questions?.correct_answer;
        if (firstAnswer === correctAnswer && a.selected_answer !== correctAnswer) {
          entry.pointsLost++;
        }
      }
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        pointsLost: data.pointsLost,
        changeRate: data.attempts > 0 ? (data.changes / data.attempts) * 100 : 0,
        attempts: data.attempts
      }))
      .filter(c => c.attempts >= 3)
      .sort((a, b) => b.pointsLost - a.pointsLost);
  }, [attempts]);

  // Trend data (last 10 sessions)
  const trendData = useMemo(() => {
    const sessionMap = new Map<string, { firstCorrect: number; finalCorrect: number; total: number; date: string }>();
    
    attempts.forEach(a => {
      if (!sessionMap.has(a.session_id)) {
        sessionMap.set(a.session_id, { firstCorrect: 0, finalCorrect: 0, total: 0, date: a.created_at.split('T')[0] });
      }
      const session = sessionMap.get(a.session_id)!;
      session.total++;
      
      if (a.is_correct) session.finalCorrect++;
      if (a.change_sequence.length > 0) {
        const firstAnswer = a.change_sequence[0];
        if (firstAnswer === a.questions?.correct_answer) session.firstCorrect++;
      } else if (a.is_correct) {
        // No changes, so first = final
        session.firstCorrect++;
      }
    });

    return Array.from(sessionMap.values())
      .slice(-10)
      .map((s, i) => ({
        session: `S${i + 1}`,
        firstInstinct: s.total > 0 ? Math.round((s.firstCorrect / s.total) * 100) : 0,
        final: s.total > 0 ? Math.round((s.finalCorrect / s.total) * 100) : 0
      }));
  }, [attempts]);

  // Training mode logic
  const startTraining = () => {
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, 10);
    setTrainingQuestions(shuffled);
    setCurrentTrainingIndex(0);
    setSelectedAnswer(null);
    setConfirmed(false);
    setShowFeedback(false);
    setTrainingResults({ correct: 0, total: 0 });
    setTrainingMode(true);
    setDecisionTimer(3);
  };

  const confirmAnswer = () => {
    if (!selectedAnswer) return;
    setConfirmed(true);
    const currentQ = trainingQuestions[currentTrainingIndex];
    const isCorrect = selectedAnswer === currentQ.correct_answer;
    setShowFeedback(true);
    setTrainingResults(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
  };

  const nextQuestion = () => {
    if (currentTrainingIndex < trainingQuestions.length - 1) {
      setCurrentTrainingIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setConfirmed(false);
      setShowFeedback(false);
      setDecisionTimer(3);
    } else {
      setTrainingMode(false);
    }
  };

  // Decision timer countdown
  useEffect(() => {
    if (trainingMode && !confirmed && selectedAnswer && decisionTimer > 0) {
      const timer = setTimeout(() => setDecisionTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [trainingMode, confirmed, selectedAnswer, decisionTimer]);

  const currentQuestion = trainingQuestions[currentTrainingIndex];

  const chartConfig = {
    firstInstinct: { label: 'First Instinct', color: 'hsl(var(--primary))' },
    final: { label: 'Final Answer', color: 'hsl(var(--muted-foreground))' }
  };

  if (!gate.canAccessTrustGut) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <UpgradePrompt feature="Trust Your Gut" description="Train your first-instinct accuracy and reduce harmful answer changes. This advanced analytics feature requires an eligible plan." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex justify-end"><Button onClick={startTraining} className="w-full shrink-0 gap-2 sm:w-auto">
            <Play className="h-4 w-4" />
            Start Training
          </Button></div>

        {/* Training Mode Overlay */}
        <AnimatePresence>
          {trainingMode && currentQuestion && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <Card className="w-full max-w-3xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      Question {currentTrainingIndex + 1} of {trainingQuestions.length}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setTrainingMode(false)}>
                      Exit Training
                    </Button>
                  </div>
                  <CardTitle className="text-lg mt-4">{currentQuestion.question_text}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Decision timer indicator */}
                  {!confirmed && selectedAnswer && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Decide in {decisionTimer}s — trust your gut!</span>
                      <Progress value={(decisionTimer / 3) * 100} className="h-2 flex-1 max-w-32" />
                    </div>
                  )}

                  {/* Options */}
                  <div className="space-y-2">
                    {Object.entries(currentQuestion.options as Record<string, string>).map(([key, value]) => {
                      const isSelected = selectedAnswer === key;
                      const isCorrect = key === currentQuestion.correct_answer;
                      
                      let optionClass = 'border-border hover:border-primary/50';
                      if (showFeedback) {
                        if (isCorrect) optionClass = 'border-green-500 bg-green-500/10';
                        else if (isSelected && !isCorrect) optionClass = 'border-red-500 bg-red-500/10';
                      } else if (isSelected) {
                        optionClass = 'border-primary bg-primary/10';
                      }

                      return (
                        <button
                          key={key}
                          disabled={confirmed}
                          onClick={() => {
                            if (!confirmed) {
                              setSelectedAnswer(key);
                              setDecisionTimer(3);
                            }
                          }}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${optionClass} ${confirmed ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className="font-medium">{key}.</span> {value}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback */}
                  {showFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-lg ${selectedAnswer === currentQuestion.correct_answer ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        {selectedAnswer === currentQuestion.correct_answer ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="text-green-700 dark:text-green-400">Your first instinct was correct!</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-red-500" />
                            <span className="text-red-700 dark:text-red-400">Your first instinct was incorrect</span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-4">
                    {!confirmed ? (
                      <Button onClick={confirmAnswer} disabled={!selectedAnswer}>
                        Lock In Answer
                      </Button>
                    ) : (
                      <Button onClick={nextQuestion}>
                        {currentTrainingIndex < trainingQuestions.length - 1 ? (
                          <>Next Question <ArrowRight className="h-4 w-4 ml-2" /></>
                        ) : (
                          'Finish Training'
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Progress */}
                  {confirmed && (
                    <div className="text-center text-sm text-muted-foreground">
                      Score: {trainingResults.correct}/{trainingResults.total}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Training Complete Modal */}
        <AnimatePresence>
          {!trainingMode && trainingResults.total > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Award className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Training Complete!</h3>
                        <p className="text-muted-foreground">
                          You got {trainingResults.correct} out of {trainingResults.total} correct using your first instinct
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setTrainingResults({ correct: 0, total: 0 })}>
                        Dismiss
                      </Button>
                      <Button onClick={startTraining}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Train Again
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">First Instinct Accuracy</p>
                  <p className="text-2xl font-bold">{stats.firstInstinctAccuracy.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Final Answer Accuracy</p>
                  <p className="text-2xl font-bold">{stats.finalAccuracy.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Points Lost by Changing</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.pointsLost}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Points Gained by Changing</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.pointsGained}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_1.9fr]">
          <Card className="relative overflow-hidden border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.07] via-[#081224]/90 to-[#081224]/75">
            <CardContent className="relative p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Brain className="h-4 w-4 text-cyan-300" />
                First instinct vs final answer
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.045] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-300/80">First instinct</p>
                  <p className="mt-2 text-3xl font-bold text-white">{stats.firstInstinctAccuracy.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Final answer</p>
                  <p className="mt-2 text-3xl font-bold text-white">{stats.finalAccuracy.toFixed(1)}%</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Based on attempts where an answer change was recorded. This shows what happened after changing, not whether you should always keep your first answer.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-red-500/20 bg-red-500/[0.035]">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-red-300/80">Correct → Wrong</p>
                <p className="mt-2 text-2xl font-bold text-white">{stats.changeAnalysis.correctToWrong}</p>
                <p className="mt-1 text-xs text-slate-500">Points lost</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20 bg-emerald-500/[0.035]">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-300/80">Wrong → Correct</p>
                <p className="mt-2 text-2xl font-bold text-white">{stats.changeAnalysis.wrongToCorrect}</p>
                <p className="mt-1 text-xs text-slate-500">Points gained</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.025]">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Wrong → Wrong</p>
                <p className="mt-2 text-2xl font-bold text-white">{stats.changeAnalysis.wrongToWrong}</p>
                <p className="mt-1 text-xs text-slate-500">Changed, still wrong</p>
              </CardContent>
            </Card>
            <Card className="border-purple-400/15 bg-purple-400/[0.035]">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-purple-300/80">Change rate</p>
                <p className="mt-2 text-2xl font-bold text-white">{stats.changeRate.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-slate-500">{stats.totalWithChanges} changed attempts</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="border-white/10 bg-[#081224]/75 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg">Change outcome</CardTitle>
              <CardDescription>What happened when you changed an answer.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Correct → Wrong', value: stats.changeAnalysis.correctToWrong, icon: XCircle, tone: 'text-red-400 bg-red-400/10' },
                  { label: 'Wrong → Correct', value: stats.changeAnalysis.wrongToCorrect, icon: CheckCircle2, tone: 'text-emerald-400 bg-emerald-400/10' },
                  { label: 'Wrong → Wrong', value: stats.changeAnalysis.wrongToWrong, icon: AlertTriangle, tone: 'text-slate-400 bg-white/[0.04]' },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm text-slate-300">{item.label}</span>
                      </div>
                      <span className="font-mono text-lg font-semibold text-white">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#081224]/75 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg">What the data says</CardTitle>
              <CardDescription>A neutral reading of the recorded change outcomes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.035] p-5 text-center">
                <p className="text-4xl font-bold text-white">{Math.abs(stats.firstInstinctAccuracy - stats.finalAccuracy).toFixed(1)}%</p>
                <p className="mt-2 text-sm text-slate-400">
                  difference between first-instinct and final-answer accuracy
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <p className="text-xs text-slate-600">Changed attempts</p>
                  <p className="mt-1 font-semibold text-white">{stats.totalWithChanges}</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <p className="text-xs text-slate-600">All attempts</p>
                  <p className="mt-1 font-semibold text-white">{stats.totalAttempts}</p>
                </div>
              </div>
              {stats.pointsLost !== stats.pointsGained && (
                <p className="text-xs leading-5 text-slate-500">
                  Recorded changes produced {stats.pointsLost} correct-to-wrong outcomes and {stats.pointsGained} wrong-to-correct outcomes. The engine reports the pattern rather than prescribing a universal rule.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
          <Card className="border-white/10 bg-[#081224]/75 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg">Where changes matter</CardTitle>
              <CardDescription>Subjects with recorded answer-change activity.</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryBreakdown.length ? (
                <div className="space-y-3">
                  {categoryBreakdown.slice(0, 8).map(row => (
                    <div key={row.category} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm text-slate-300">{row.category}</span>
                        <span className="font-mono text-xs text-slate-400">{row.changeRate.toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-cyan-300" style={{ width: `${Math.min(100, row.changeRate)}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-600">{row.attempts} attempts · {row.pointsLost} correct-to-wrong</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                  Complete more practice to build change-pattern data.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#081224]/75 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg">Progress across sessions</CardTitle>
              <CardDescription>First-instinct and final-answer accuracy over recent sessions.</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length > 1 ? (
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <AreaChart data={trendData}>
                    <XAxis dataKey="session" />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="firstInstinct" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} name="First Instinct" />
                    <Area type="monotone" dataKey="final" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.08} name="Final Answer" />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500">
                  Complete more practice sessions to see a trend.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
  );
}
