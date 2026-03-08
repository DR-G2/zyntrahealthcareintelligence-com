import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Brain, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  Clock,
  Zap,
  Award,
  BarChart3,
  Play,
  RotateCcw
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from 'recharts';
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
  const [activeTab, setActiveTab] = useState('stats');
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              Trust Your Gut
            </h1>
            <p className="text-muted-foreground mt-1">
              Train your first-instinct accuracy and reduce harmful answer changes
            </p>
          </div>
          <Button onClick={startTraining} className="gap-2">
            <Play className="h-4 w-4" />
            Start Training
          </Button>
        </div>

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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Problem Areas
            </TabsTrigger>
            <TabsTrigger value="trend" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Progress
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Change Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Change Outcome Analysis</CardTitle>
                  <CardDescription>
                    What happens when you change your answer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span>Correct → Wrong</span>
                      </div>
                      <span className="font-bold text-red-600 dark:text-red-400">{stats.changeAnalysis.correctToWrong}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span>Wrong → Correct</span>
                      </div>
                      <span className="font-bold text-green-600 dark:text-green-400">{stats.changeAnalysis.wrongToCorrect}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                        <span>Wrong → Wrong</span>
                      </div>
                      <span className="font-bold">{stats.changeAnalysis.wrongToWrong}</span>
                    </div>
                  </div>

                  {stats.pointsLost > stats.pointsGained && (
                    <div className="mt-6 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-700 dark:text-amber-400">Changing hurts your score</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            You've lost {stats.pointsLost - stats.pointsGained} net points by changing answers. 
                            Practice trusting your first instinct.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Key Insight */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Key Insight</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-6">
                      <div className="text-5xl font-bold mb-2">
                        {(stats.firstInstinctAccuracy - stats.finalAccuracy).toFixed(1)}%
                      </div>
                      <p className="text-muted-foreground">
                        {stats.firstInstinctAccuracy > stats.finalAccuracy 
                          ? 'Higher accuracy if you trusted your gut'
                          : stats.firstInstinctAccuracy < stats.finalAccuracy
                          ? 'Your changes improved your score'
                          : 'No difference between first and final'
                        }
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Questions with changes</span>
                        <span className="font-medium">{stats.totalWithChanges}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Overall change rate</span>
                        <span className="font-medium">{stats.changeRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Category Breakdown</CardTitle>
                <CardDescription>
                  Subjects where answer changes hurt you the most
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoryBreakdown.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-center">Points Lost</TableHead>
                        <TableHead className="text-center">Change Rate</TableHead>
                        <TableHead className="text-center">Attempts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryBreakdown.slice(0, 10).map(row => (
                        <TableRow key={row.category}>
                          <TableCell className="font-medium">{row.category}</TableCell>
                          <TableCell className="text-center">
                            {row.pointsLost > 0 ? (
                              <Badge variant="destructive">{row.pointsLost}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{row.changeRate.toFixed(1)}%</TableCell>
                          <TableCell className="text-center text-muted-foreground">{row.attempts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Complete more practice sessions to see category insights
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trend" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Accuracy Trend Over Sessions</CardTitle>
                <CardDescription>
                  Compare your first-instinct vs final-answer accuracy
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trendData.length > 1 ? (
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <AreaChart data={trendData}>
                      <XAxis dataKey="session" />
                      <YAxis domain={[0, 100]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="firstInstinct" 
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.2}
                        name="First Instinct"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="final" 
                        stroke="hsl(var(--muted-foreground))" 
                        fill="hsl(var(--muted-foreground))" 
                        fillOpacity={0.1}
                        name="Final Answer"
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Complete more practice sessions to see trends
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
