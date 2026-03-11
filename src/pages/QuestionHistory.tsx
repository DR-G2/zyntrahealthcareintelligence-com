import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Clock, BookOpen, ArrowRight, Filter, XCircle, CheckCircle,
  ChevronLeft, ChevronRight, Search, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const PAGE_SIZE = 20;

export default function QuestionHistory() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['question-history', user?.id],
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

  const categories = useMemo(() => {
    const cats = new Set(attempts.map(a => a.questions?.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [attempts]);

  const filtered = useMemo(() => {
    let list = attempts;
    if (filter === 'correct') list = list.filter(a => a.is_correct);
    if (filter === 'incorrect') list = list.filter(a => !a.is_correct);
    if (categoryFilter !== 'all') list = list.filter(a => a.questions?.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.questions?.question_text?.toLowerCase().includes(q));
    }
    return list;
  }, [attempts, filter, categoryFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: attempts.length,
    correct: attempts.filter(a => a.is_correct).length,
    incorrect: attempts.filter(a => !a.is_correct).length,
    avgTime: attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.time_taken_seconds, 0) / attempts.length) : 0,
  }), [attempts]);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Question History
          </h1>
          <p className="text-muted-foreground mt-1">Review all your past attempts</p>
        </div>

        {!gate.canAccessHistory ? (
          <UpgradePrompt feature="Question History" description="Upgrade to review your complete attempt history." variant="card" />
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : attempts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <h2 className="text-xl font-display font-bold">No Attempts Yet</h2>
              <p className="text-muted-foreground">Complete some practice sessions first.</p>
              <Button asChild><Link to="/practice">Start Practice <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total', value: stats.total },
                { label: 'Correct', value: stats.correct },
                { label: 'Incorrect', value: stats.incorrect },
                { label: 'Avg Time', value: `${stats.avgTime}s` },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold font-display">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search questions..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }} className="pl-9" />
              </div>
              <Select value={filter} onValueChange={(v: any) => { setFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="correct">Correct</SelectItem>
                  <SelectItem value="incorrect">Incorrect</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { setFilter('incorrect'); setPage(0); }} className="gap-1">
                <XCircle className="h-3.5 w-3.5" /> Review Incorrect
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">{filtered.length} results</p>

            {/* List */}
            <div className="space-y-3">
              {paged.map(attempt => {
                const q = attempt.questions;
                const changeSeq = Array.isArray(attempt.change_sequence) ? attempt.change_sequence : [];
                const isExpanded = expandedId === attempt.id;
                return (
                  <Card key={attempt.id} className="hover:border-primary/20 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{q.category}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {attempt.time_taken_seconds}s
                            </span>
                            {attempt.answer_changes_count > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {attempt.answer_changes_count} change{attempt.answer_changes_count > 1 ? 's' : ''}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(attempt.created_at).toLocaleDateString()} {new Date(attempt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <Badge className={cn('shrink-0', attempt.is_correct ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
                          {attempt.is_correct ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {attempt.is_correct ? 'Correct' : 'Wrong'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span>Your answer: <strong className={attempt.is_correct ? 'text-success' : 'text-destructive'}>{attempt.selected_answer}</strong></span>
                        {!attempt.is_correct && <span>Correct: <strong className="text-success">{q.correct_answer}</strong></span>}
                      </div>
                      {changeSeq.length > 1 && (
                        <p className="mt-1 text-xs text-muted-foreground">Path: {changeSeq.join(' → ')}</p>
                      )}
                      <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setExpandedId(isExpanded ? null : attempt.id)}>
                        {isExpanded ? 'Hide Explanation' : 'Show Explanation'}
                      </Button>
                      {isExpanded && q.explanation && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                          {q.explanation}
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
