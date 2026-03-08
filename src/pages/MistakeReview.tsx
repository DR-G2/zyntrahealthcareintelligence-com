import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { XCircle, RefreshCw, Zap, ArrowRight, Clock, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';

interface AttemptRow {
  id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  answer_changes_count: number;
  change_sequence: any;
  time_taken_seconds: number;
  time_to_first_click: number | null;
  created_at: string;
  questions: {
    question_text: string;
    correct_answer: string;
    category: string;
    explanation: string | null;
    options: any;
  };
}

function ReviewCard({ attempt }: { attempt: AttemptRow }) {
  const [expanded, setExpanded] = useState(false);
  const q = attempt.questions;
  const changeSeq = Array.isArray(attempt.change_sequence) ? attempt.change_sequence : [];

  // Determine if it was a panic change (right→wrong)
  const isPanicChange = changeSeq.length > 0 && changeSeq[0] === q.correct_answer && attempt.selected_answer !== q.correct_answer;
  const isGoodInstinct = changeSeq.length > 0 && changeSeq[0] !== q.correct_answer && attempt.selected_answer === q.correct_answer;

  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{q.category}</Badge>
              {isPanicChange && <Badge variant="destructive" className="text-xs">Panic Change</Badge>}
              {isGoodInstinct && <Badge className="text-xs bg-success text-success-foreground">Good Instinct</Badge>}
              {attempt.time_taken_seconds < 15 && <Badge variant="secondary" className="text-xs">Quick Guess</Badge>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {attempt.time_taken_seconds}s
            </div>
            {attempt.answer_changes_count > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {attempt.answer_changes_count} change{attempt.answer_changes_count > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-sm">
          <span>
            Your answer: <span className={cn('font-semibold', attempt.is_correct ? 'text-success' : 'text-destructive')}>{attempt.selected_answer}</span>
          </span>
          {!attempt.is_correct && (
            <span>
              Correct: <span className="font-semibold text-success">{q.correct_answer}</span>
            </span>
          )}
        </div>

        {changeSeq.length > 1 && (
          <div className="mt-2 text-xs text-muted-foreground">
            Change path: {changeSeq.join(' → ')}
          </div>
        )}

        <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide Explanation' : 'Show Explanation'}
        </Button>

        {expanded && q.explanation && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            {q.explanation}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MistakeReview() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [activeTab, setActiveTab] = useState('incorrect');

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['mistake-review', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_attempts')
        .select('id, question_id, selected_answer, is_correct, answer_changes_count, change_sequence, time_taken_seconds, time_to_first_click, created_at, questions(question_text, correct_answer, category, explanation, options)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as AttemptRow[];
    },
    enabled: !!user,
  });

  const incorrect = useMemo(() => attempts.filter(a => !a.is_correct), [attempts]);
  const changed = useMemo(() => attempts.filter(a => a.answer_changes_count > 0), [attempts]);
  const guessed = useMemo(() => attempts.filter(a => 
    (a.time_to_first_click !== null && a.time_to_first_click < 3) || a.time_taken_seconds < 15
  ), [attempts]);

  const tabs = [
    { id: 'incorrect', label: 'Incorrect', icon: XCircle, count: incorrect.length },
    { id: 'changed', label: 'Changed Answers', icon: RefreshCw, count: changed.length },
    { id: 'guessed', label: 'Guessed', icon: Zap, count: guessed.length },
  ];

  const currentList = activeTab === 'incorrect' ? incorrect : activeTab === 'changed' ? changed : guessed;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Mistake Review
          </h1>
          <p className="text-muted-foreground mt-1">Learn from your errors — the fastest path to passing</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : attempts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <h2 className="text-xl font-display font-bold">No Attempts Yet</h2>
              <p className="text-muted-foreground">Complete some practice sessions first, then come back to review your mistakes.</p>
              <Button asChild>
                <Link to="/practice">Start Practice <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              {tabs.map(t => (
                <Card key={t.id} className={cn(
                  'cursor-pointer transition-all',
                  activeTab === t.id ? 'border-primary bg-primary/5' : 'hover:border-primary/30'
                )} onClick={() => setActiveTab(t.id)}>
                  <CardContent className="py-4 text-center">
                    <t.icon className={cn('h-5 w-5 mx-auto mb-1', activeTab === t.id ? 'text-primary' : 'text-muted-foreground')} />
                    <p className="text-2xl font-bold font-display">{t.count}</p>
                    <p className="text-xs text-muted-foreground">{t.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Question List */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-3">
                {tabs.map(t => (
                  <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="mt-4 space-y-3">
                {currentList.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No items in this category yet. Keep practising!
                    </CardContent>
                  </Card>
                ) : (
                  currentList.slice(0, 50).map(attempt => (
                    <ReviewCard key={attempt.id} attempt={attempt} />
                  ))
                )}
                {currentList.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground">
                    Showing 50 of {currentList.length} — keep reviewing to improve!
                  </p>
                )}
              </div>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
