import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Lock, Zap, Shield, Timer, ChevronLeft, ChevronRight, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { QuestionExplanation } from '@/components/practice/QuestionExplanation';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
}

const drillConfig = {
  speed: {
    title: 'Speed Round',
    desc: '10 questions in 10 minutes. Pure time management.',
    icon: Timer,
    questionCount: 10,
    timeSeconds: 600,
    canChangeAnswer: true,
    color: 'text-chart-3',
    bgColor: 'bg-chart-3/10',
  },
  commitment: {
    title: 'Commitment Drill',
    desc: 'Once you select, it locks. No going back.',
    icon: Lock,
    questionCount: 10,
    timeSeconds: 900,
    canChangeAnswer: false,
    color: 'text-chart-4',
    bgColor: 'bg-chart-4/10',
  },
  pressure: {
    title: 'Pressure Test',
    desc: 'Full exam simulation — timer, no pauses.',
    icon: Shield,
    questionCount: 20,
    timeSeconds: 1800,
    canChangeAnswer: true,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
};

type DrillType = keyof typeof drillConfig;

function DrillSelector() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display">Practice Drills</h1>
          <p className="text-muted-foreground">Choose a drill mode to train specific skills</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {(Object.entries(drillConfig) as [DrillType, typeof drillConfig.speed][]).map(([key, cfg]) => (
            <Card key={key} className="group hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg mb-2', cfg.bgColor, cfg.color)}>
                  <cfg.icon className="h-5 w-5" />
                </div>
                <CardTitle className="font-display">{cfg.title}</CardTitle>
                <CardDescription>{cfg.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-4 space-y-1">
                  <p>{cfg.questionCount} questions • {cfg.timeSeconds / 60} min</p>
                  <p>{cfg.canChangeAnswer ? 'Can revise answers' : 'Answers lock immediately'}</p>
                </div>
                <Button asChild className="w-full gap-1">
                  <Link to={`/practice/${key}`}>Start <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function DrillSession({ type }: { type: DrillType }) {
  const config = drillConfig[type];
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phase, setPhase] = useState<'intro' | 'drill' | 'results'>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [reviewQuestionIndex, setReviewQuestionIndex] = useState<number | null>(null);
  const [lockedAnswers, setLockedAnswers] = useState<Record<number, boolean>>({});
  const [answerChanges, setAnswerChanges] = useState<Record<number, number>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(config.timeSeconds);
  const [loading, setLoading] = useState(true);
  const sessionIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    const fetchQ = async () => {
      const { data } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_answer, explanation, category')
        .limit(50);
      if (data) {
        const shuffled = data.sort(() => Math.random() - 0.5).slice(0, config.questionCount);
        setQuestions(shuffled as Question[]);
      }
      setLoading(false);
    };
    fetchQ();
  }, []);

  useEffect(() => {
    if (phase !== 'drill') return;
    const interval = setInterval(() => {
      setTimeRemaining((p) => {
        if (p <= 1) { clearInterval(interval); handleFinish(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const recordTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setQuestionTimes((p) => ({ ...p, [currentIndex]: (p[currentIndex] || 0) + elapsed }));
  }, [currentIndex, questionStartTime]);

  const selectAnswer = (answer: string) => {
    if (lockedAnswers[currentIndex]) return;
    if (selectedAnswers[currentIndex] && selectedAnswers[currentIndex] !== answer) {
      setAnswerChanges((p) => ({ ...p, [currentIndex]: (p[currentIndex] || 0) + 1 }));
    }
    setSelectedAnswers((p) => ({ ...p, [currentIndex]: answer }));
    if (!config.canChangeAnswer) {
      setLockedAnswers((p) => ({ ...p, [currentIndex]: true }));
    }
  };

  const goTo = (i: number) => {
    recordTime();
    setCurrentIndex(i);
    setQuestionStartTime(Date.now());
  };

  const handleFinish = async () => {
    if (phase === 'results') return;
    recordTime();
    setPhase('results');

    if (!user) return;
    const inserts = questions.map((q, i) => ({
      user_id: user.id,
      question_id: q.id,
      selected_answer: selectedAnswers[i] || '',
      time_taken_seconds: questionTimes[i] || 0,
      answer_changes_count: answerChanges[i] || 0,
      is_correct: selectedAnswers[i] === q.correct_answer,
      session_id: sessionIdRef.current,
    }));
    await supabase.from('user_attempts').insert(inserts);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerPercent = (timeRemaining / config.timeSeconds) * 100;

  if (loading) return <AppLayout><div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppLayout>;

  if (phase === 'intro') {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12">
          <Card>
            <CardHeader className="text-center">
              <div className={cn('mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl', config.bgColor, config.color)}>
                <config.icon className="h-7 w-7" />
              </div>
              <CardTitle className="text-2xl font-display">{config.title}</CardTitle>
              <CardDescription>{config.desc}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">{config.questionCount} questions • {config.timeSeconds / 60} minutes</p>
              <Button size="lg" onClick={() => { setPhase('drill'); setQuestionStartTime(Date.now()); }}>
                Start Drill
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (phase === 'results') {
    // Full-page explanation view for a single question
    if (reviewQuestionIndex !== null) {
      const q = questions[reviewQuestionIndex];
      return (
        <AppLayout>
          <AnimatePresence mode="wait">
            <QuestionExplanation
              key={reviewQuestionIndex}
              question={q}
              userAnswer={selectedAnswers[reviewQuestionIndex]}
              questionIndex={reviewQuestionIndex}
              onBack={() => setReviewQuestionIndex(null)}
            />
          </AnimatePresence>
        </AppLayout>
      );
    }

    const correct = questions.filter((q, i) => selectedAnswers[i] === q.correct_answer).length;
    const total = questions.length;
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-display">Drill Complete!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="text-5xl font-bold font-display text-primary">{correct}/{total}</div>
              <p className="text-muted-foreground">{Math.round((correct / total) * 100)}% accuracy</p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" asChild><Link to="/practice">More Drills</Link></Button>
                <Button asChild><Link to="/profile">View Profile</Link></Button>
              </div>
            </CardContent>
          </Card>

          {/* Review answers — clickable cards */}
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-display font-semibold">Review Questions</h2>
            {questions.map((q, i) => {
              const userAnswer = selectedAnswers[i];
              const isCorrect = userAnswer === q.correct_answer;
              return (
                <Card
                  key={q.id}
                  className={cn('border-l-4 cursor-pointer hover:shadow-md transition-shadow', isCorrect ? 'border-l-success' : 'border-l-destructive')}
                  onClick={() => setReviewQuestionIndex(i)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1 line-clamp-2">{q.question_text}</p>
                        <p className="text-xs text-muted-foreground">
                          Your answer: <strong>{userAnswer || 'Not answered'}</strong> •
                          Correct: <strong>{q.correct_answer}</strong>
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

  const question = questions[currentIndex];
  if (!question) return <AppLayout><div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppLayout>;
  const options = question.options as string[];

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Q{currentIndex + 1}/{questions.length}</span>
            <span className={cn('font-mono font-bold', timerPercent > 50 ? 'text-success' : timerPercent > 20 ? 'text-warning' : 'text-destructive')}>
              <Clock className="inline h-4 w-4 mr-1" />{formatTime(timeRemaining)}
            </span>
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
            <Button onClick={handleFinish} className="gap-1">
              <Lock className="h-4 w-4" /> Finish
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function Practice() {
  const { type } = useParams<{ type?: string }>();

  if (!type) return <DrillSelector />;
  if (type in drillConfig) return <DrillSession type={type as DrillType} />;
  return <DrillSelector />;
}
