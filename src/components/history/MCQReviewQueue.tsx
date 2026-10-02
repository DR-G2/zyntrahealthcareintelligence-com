import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock3, RotateCcw, Search, Target, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Attempt {
  id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  answer_changes_count: number;
  time_taken_seconds: number;
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

type Reason = 'all' | 'incorrect' | 'unstable';

function normalizeOptions(value: any): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') {
    return Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => String(v));
  }
  return [];
}

export function MCQReviewQueue() {
  const { user } = useAuth();
  const [reason, setReason] = useState<Reason>('all');
  const [subject, setSubject] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['mcq-review-queue', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_attempts')
        .select('id, question_id, selected_answer, is_correct, answer_changes_count, time_taken_seconds, created_at, questions(question_text, correct_answer, category, subtopic, difficulty, explanation, options)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as Attempt[];
    },
    enabled: !!user,
  });

  const latestByQuestion = useMemo(() => {
    const map = new Map<string, Attempt[]>();
    attempts.forEach(a => {
      const list = map.get(a.question_id) || [];
      list.push(a);
      map.set(a.question_id, list);
    });
    return map;
  }, [attempts]);

  const queue = useMemo(() => {
    const rows = Array.from(latestByQuestion.entries()).map(([questionId, history]) => {
      const latest = history[0];
      const incorrectCount = history.filter(a => !a.is_correct).length;
      const repeatedMiss = incorrectCount >= 2;
      const unstable = latest.answer_changes_count >= 2;
      const needsReview = !latest.is_correct || unstable;
      const mastery = latest.is_correct && history.length >= 2 && history.filter(a => a.is_correct).length / history.length >= 0.8;
      return { questionId, latest, history, incorrectCount, repeatedMiss, unstable, needsReview, mastery };
    }).filter(row => row.needsReview && !row.mastery);

    return rowSort(queue);
  }, [latestByQuestion]);

  const subjects = useMemo(() => Array.from(new Set(queue.map(r => r.latest.questions?.category).filter(Boolean))).sort(), [queue]);

  const filtered = useMemo(() => {
    let rows = queue;
    if (reason === 'incorrect') rows = rows.filter(r => !r.latest.is_correct);
    if (reason === 'unstable') rows = rows.filter(r => r.unstable);
    if (subject !== 'all') rows = rows.filter(r => r.latest.questions?.category === subject);
    if (search.trim()) {
      const term = search.toLowerCase();
      rows = rows.filter(r =>
        r.questionId.toLowerCase().includes(term) ||
        r.latest.questions?.question_text?.toLowerCase().includes(term) ||
        r.latest.questions?.category?.toLowerCase().includes(term) ||
        r.latest.questions?.subtopic?.toLowerCase().includes(term)
      );
    }
    return rows;
  }, [queue, reason, subject, search]);

  const stats = useMemo(() => ({
    queue: queue.length,
    repeated: queue.filter(r => r.repeatedMiss).length,
    unstable: queue.filter(r => r.unstable).length,
    subjects: new Set(queue.map(r => r.latest.questions?.category).filter(Boolean)).size,
  }), [queue]);

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div>;

  if (!attempts.length) {
    return <Card><CardContent className="py-14 text-center space-y-3"><Target className="h-10 w-10 mx-auto text-muted-foreground/50" /><h2 className="font-display text-xl font-bold">Review Queue is empty</h2><p className="text-sm text-muted-foreground">Complete some MCQs and Zyntra will surface questions that need another look.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Needs Review', stats.queue],
          ['Repeated Misses', stats.repeated],
          ['Unstable Answers', stats.unstable],
          ['Subjects', stats.subjects],
        ].map(([label, value]) => (
          <Card key={label as string}><CardContent className="py-4 text-center"><p className="text-2xl font-bold font-display">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search QN, question, subject or subtopic…" className="pl-9" />
            </div>
            <Select value={reason} onValueChange={(v: Reason) => setReason(v)}>
              <SelectTrigger className="w-full lg:w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Review Reasons</SelectItem>
                <SelectItem value="incorrect">Incorrect</SelectItem>
                <SelectItem value="unstable">Unstable Answer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-full lg:w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">{filtered.length} questions need review</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filtered.map(row => {
          const q = row.latest.questions;
          const options = normalizeOptions(q?.options);
          const isOpen = expanded === row.questionId;
          return (
            <Card key={row.questionId} className={cn('transition-colors', row.repeatedMiss && 'border-destructive/30')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="outline">{q?.category || 'Uncategorised'}</Badge>
                      {q?.subtopic && <Badge variant="secondary">{q.subtopic}</Badge>}
                      {row.repeatedMiss && <Badge variant="destructive">Repeated miss</Badge>}
                      {row.unstable && <Badge variant="outline">Answer changed</Badge>}
                    </div>
                    <p className="font-medium text-sm leading-relaxed">{q?.question_text || 'Question unavailable'}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {row.latest.time_taken_seconds}s</span>
                      <span>{row.history.length} attempt{row.history.length === 1 ? '' : 's'}</span>
                      <span>{row.incorrectCount} incorrect</span>
                    </div>
                  </div>
                  <Badge className={cn('shrink-0', row.latest.is_correct ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
                    {row.latest.is_correct ? 'Correct' : 'Review'}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : row.questionId)}>
                    {isOpen ? 'Hide Explanation' : 'Review Explanation'}
                  </Button>
                </div>

                {isOpen && (
                  <div className="mt-4 rounded-xl border bg-muted/30 p-4 space-y-4">
                    <div className="space-y-2">
                      {options.map((option, i) => {
                        const letter = String.fromCharCode(65 + i);
                        return <div key={letter} className={cn('rounded-md border p-2.5 text-sm', q?.correct_answer === letter && 'border-success/40 bg-success/5')}><strong className="mr-2">{letter}.</strong>{option}</div>;
                      })}
                    </div>
                    <div className="text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Explanation</p><p className="leading-relaxed">{q?.explanation || 'No explanation is available for this question.'}</p></div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {row.latest.is_correct ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      Latest answer: <strong>{row.latest.selected_answer}</strong> · Correct: <strong>{q?.correct_answer || '—'}</strong>
                    </div>
                    <div className="text-xs text-muted-foreground">Review is prioritised because {row.repeatedMiss ? 'you have missed this question repeatedly' : row.unstable ? 'your latest answer involved multiple changes' : 'your latest attempt was incorrect'}.</div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!filtered.length && <Card><CardContent className="py-10 text-center text-muted-foreground">Nothing matches these review filters.</CardContent></Card>}
    </div>
  );
}

function rowSort<T extends { latest: Attempt; repeatedMiss: boolean; unstable: boolean; incorrectCount: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    Number(b.repeatedMiss) - Number(a.repeatedMiss) ||
    Number(b.unstable) - Number(a.unstable) ||
    b.incorrectCount - a.incorrectCount ||
    new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime()
  );
}
