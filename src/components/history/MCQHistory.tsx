import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock, BookOpen, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Search, RotateCcw, SlidersHorizontal, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
    subtopic?: string | null;
    difficulty?: string | null;
    explanation: string | null;
    options: any;
  };
}

const PAGE_SIZE = 20;
type ResultFilter = 'all' | 'correct' | 'incorrect';
type DateFilter = 'all' | 'today' | '7d' | '30d';

function normalizeOptions(value: any): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => String(v));
  }
  return [];
}

export function MCQHistory() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [subtopicFilter, setSubtopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['mcq-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_attempts')
        .select('id, question_id, selected_answer, is_correct, answer_changes_count, change_sequence, time_taken_seconds, time_to_first_click, created_at, questions(question_text, correct_answer, category, subtopic, difficulty, explanation, options)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as AttemptRow[];
    },
    enabled: !!user,
  });

  const subjects = useMemo(
    () => Array.from(new Set(attempts.map(a => a.questions?.category).filter(Boolean))).sort(),
    [attempts]
  );

  const subtopics = useMemo(() => {
    const source = subjectFilter === 'all'
      ? attempts
      : attempts.filter(a => a.questions?.category === subjectFilter);
    return Array.from(new Set(source.map(a => a.questions?.subtopic).filter(Boolean))).sort();
  }, [attempts, subjectFilter]);

  const filtered = useMemo(() => {
    let list = attempts;
    if (filter === 'correct') list = list.filter(a => a.is_correct);
    if (filter === 'incorrect') list = list.filter(a => !a.is_correct);
    if (subjectFilter !== 'all') list = list.filter(a => a.questions?.category === subjectFilter);
    if (subtopicFilter !== 'all') list = list.filter(a => a.questions?.subtopic === subtopicFilter);
    if (difficultyFilter !== 'all') list = list.filter(a => (a.questions?.difficulty || '').toLowerCase() === difficultyFilter);

    if (dateFilter !== 'all') {
      const now = new Date();
      const start = new Date(now);
      if (dateFilter === 'today') start.setHours(0, 0, 0, 0);
      if (dateFilter === '7d') start.setDate(start.getDate() - 7);
      if (dateFilter === '30d') start.setDate(start.getDate() - 30);
      list = list.filter(a => new Date(a.created_at) >= start);
    }

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.questions?.question_text?.toLowerCase().includes(term) ||
        a.questions?.category?.toLowerCase().includes(term) ||
        a.questions?.subtopic?.toLowerCase().includes(term) ||
        a.question_id.toLowerCase().includes(term)
      );
    }

    return list;
  }, [attempts, filter, subjectFilter, subtopicFilter, difficultyFilter, dateFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const questionTrajectories = useMemo(() => {
    const map = new Map<string, AttemptRow[]>();
    attempts.forEach(a => {
      const list = map.get(a.question_id) || [];
      list.push(a);
      map.set(a.question_id, list);
    });
    return map;
  }, [attempts]);

  const stats = useMemo(() => ({
    total: attempts.length,
    correct: attempts.filter(a => a.is_correct).length,
    incorrect: attempts.filter(a => !a.is_correct).length,
    unique: new Set(attempts.map(a => a.question_id)).size,
    avgTime: attempts.length
      ? Math.round(attempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) / attempts.length)
      : 0,
  }), [attempts]);

  const getMastery = (history: AttemptRow[]) => {
    const ordered = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const recent = ordered.slice(-3);
    const accuracy = ordered.filter(a => a.is_correct).length / ordered.length;
    const recentAccuracy = recent.filter(a => a.is_correct).length / recent.length;
    const avgChanges = recent.reduce((s, a) => s + (a.answer_changes_count || 0), 0) / recent.length;
    if (ordered.length >= 3 && recentAccuracy >= 0.67 && accuracy >= 0.7 && avgChanges < 2) return 'Reinforced';
    if (ordered.length >= 2 && recentAccuracy === 1 && avgChanges < 2) return 'Improving';
    if (ordered.length >= 2 && recentAccuracy < 0.5) return 'Needs Work';
    if (avgChanges >= 2) return 'Unstable';
    return ordered[ordered.length - 1].is_correct ? 'Developing' : 'Needs Review';
  };

  const getTrajectory = (history: AttemptRow[]) => {
    const ordered = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return ordered.map(a => a.is_correct ? '✓' : '✕').join(' → ');
  };

  const resetFilters = () => {
    setFilter('all');
    setSubjectFilter('all');
    setSubtopicFilter('all');
    setDifficultyFilter('all');
    setDateFilter('all');
    setSearchQuery('');
    setPage(0);
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}</div>;
  }

  if (attempts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto" />
          <h2 className="text-xl font-display font-bold">No Attempts Yet</h2>
          <p className="text-muted-foreground">Complete some practice sessions first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Attempts', value: stats.total },
          { label: 'Unique QNs', value: stats.unique },
          { label: 'Correct', value: stats.correct },
          { label: 'Incorrect', value: stats.incorrect },
          { label: 'Avg Time', value: stats.avgTime + 's' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-4 text-center">
              <p className="text-xl sm:text-2xl font-bold font-display">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/10">
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search question, subject, subtopic or QN ID…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v: ResultFilter) => { setFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full lg:w-[145px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="correct">Correct</SelectItem>
                <SelectItem value="incorrect">Incorrect</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={v => { setSubjectFilter(v); setSubtopicFilter('all'); setPage(0); }}>
              <SelectTrigger className="w-full lg:w-[190px]"><SelectValue placeholder="All Subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-3">
            <Select value={subtopicFilter} onValueChange={v => { setSubtopicFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[190px]"><SelectValue placeholder="All Subtopics" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subtopics</SelectItem>
                {subtopics.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={difficultyFilter} onValueChange={v => { setDifficultyFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="All Levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="difficult">Difficult</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(v: DateFilter) => { setDateFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="All Dates" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-muted-foreground">{filtered.length} matching attempts</p>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filters update instantly
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {paged.map(attempt => {
          const q = attempt.questions;
          const options = normalizeOptions(q?.options);
          const changeSeq = Array.isArray(attempt.change_sequence) ? attempt.change_sequence : [];
          const history = questionTrajectories.get(attempt.question_id) || [attempt];
          const mastery = getMastery(history);
          const trajectory = getTrajectory(history);
          const isExpanded = expandedId === attempt.id;

          return (
            <Card key={attempt.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{q?.question_text || 'Question unavailable'}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{q?.category || 'Uncategorised'}</Badge>
                      {q?.subtopic && <Badge variant="secondary" className="text-xs">{q.subtopic}</Badge>}
                      {q?.difficulty && <Badge variant="outline" className="text-xs capitalize">{q.difficulty}</Badge>}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {attempt.time_taken_seconds}s
                      </span>
                      {attempt.answer_changes_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {attempt.answer_changes_count} change{attempt.answer_changes_count > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(attempt.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Badge className={cn('shrink-0', attempt.is_correct ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
                    {attempt.is_correct ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {attempt.is_correct ? 'Correct' : 'Wrong'}
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span>Your answer: <strong className={attempt.is_correct ? 'text-success' : 'text-destructive'}>{attempt.selected_answer}</strong></span>
                  {!attempt.is_correct && <span>Correct: <strong className="text-success">{q?.correct_answer || '—'}</strong></span>}
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {mastery === 'Reinforced' || mastery === 'Improving' ? <TrendingUp className="h-3 w-3" /> : mastery === 'Needs Work' || mastery === 'Needs Review' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {mastery}
                  </span>
                </div>
                {history.length > 1 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Trajectory: <strong className="text-foreground">{trajectory}</strong></span>
                    <span>•</span>
                    <span>{history.length} attempts on this question</span>
                  </div>
                )}

                {changeSeq.length > 1 && (
                  <p className="mt-1 text-xs text-muted-foreground">Path: {changeSeq.join(' → ')}</p>
                )}

                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setExpandedId(isExpanded ? null : attempt.id)}>
                  {isExpanded ? 'Hide Explanation' : 'Show Explanation'}
                </Button>

                {isExpanded && (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="space-y-2">
                      {options.map((option, index) => {
                        const letter = String.fromCharCode(65 + index);
                        return (
                          <div key={letter} className={cn('rounded-md border p-2.5 text-sm', q?.correct_answer === letter && 'border-success/40 bg-success/5')}>
                            <strong className="mr-2">{letter}.</strong>{option}
                          </div>
                        );
                      })}
                    </div>
                    {q?.explanation && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Explanation</p>
                        <p className="text-sm leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {paged.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No attempts match these filters.</CardContent></Card>
      )}

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
    </div>
  );
}
