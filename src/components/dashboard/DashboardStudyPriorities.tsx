import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UpgradePrompt } from '@/components/UpgradePrompt';

interface Priority {
  category: string;
  priority: string;
  accuracy?: number;
  attempt_count?: number;
  daily_questions?: number;
  study_tip?: string;
}
interface SavedPlan {
  focus_areas: Priority[];
  weekly_schedule: { day: string; total_questions: number; topics: { category: string; count: number }[] }[];
  recommendations?: { tip: string; reason: string }[];
  motivation?: string;
}
interface SubjectRow { subject: string | null; accuracy: number | null; attempt_count: number | null; }

function isSavedPlan(value: unknown): value is SavedPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<SavedPlan>;
  return Array.isArray(plan.focus_areas)
    && plan.focus_areas.every(task => task && typeof task.category === 'string' && typeof task.priority === 'string')
    && Array.isArray(plan.weekly_schedule)
    && plan.weekly_schedule.every(day => day && typeof day.day === 'string' && Number.isFinite(day.total_questions)
      && Array.isArray(day.topics) && day.topics.every(topic => topic && typeof topic.category === 'string' && Number.isFinite(topic.count)));
}
function priorityTone(priority: string) {
  if (priority === 'high') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (priority === 'medium') return 'border-warning/30 bg-warning/10 text-warning';
  if (priority === 'maintain') return 'border-success/30 bg-success/10 text-success';
  return 'border-border bg-muted text-muted-foreground';
}

export function DashboardStudyPriorities() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [usingSavedPlan, setUsingSavedPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const refresh = useCallback(() => setRetry(value => value + 1), []);

  useEffect(() => {
    if (gate.loading) return;
    if (!user || !gate.canAccessStudyPlan) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [planRes, subjectRes] = await Promise.all([
          supabase.from('study_plans').select('tasks').eq('user_id', user.id).maybeSingle(),
          supabase.from('subject_dna').select('subject, accuracy, attempt_count').eq('user_id', user.id).order('accuracy', { ascending: true }),
        ]);
        if (planRes.error) throw planRes.error;
        if (subjectRes.error) throw subjectRes.error;
        if (cancelled) return;
        let savedPriorities: Priority[] = [];
        if (planRes.data?.tasks != null) {
          if (!isSavedPlan(planRes.data.tasks)) throw new Error('The saved study plan could not be read. Open Study Plan to review it.');
          savedPriorities = planRes.data.tasks.focus_areas;
        }
        const recordedPriorities: Priority[] = ((subjectRes.data || []) as SubjectRow[])
          .flatMap(row => {
            const accuracy = Number(row.accuracy);
            const attempts = Number(row.attempt_count);
            if (!row.subject || !Number.isFinite(accuracy) || !Number.isFinite(attempts) || attempts <= 0) return [];
            return [{ category: row.subject, priority: accuracy < 60 ? 'high' : accuracy < 80 ? 'medium' : 'maintain', accuracy: Math.round(accuracy), attempt_count: attempts }];
          });
        setUsingSavedPlan(savedPriorities.length > 0);
        setPriorities(savedPriorities.length > 0 ? savedPriorities : recordedPriorities);
      } catch (cause) {
        if (!cancelled) {
          setPriorities([]);
          setError(cause instanceof Error ? cause.message : 'Study priorities could not load.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, gate.loading, gate.canAccessStudyPlan, retry]);

  return (
    <section aria-labelledby="dashboard-priorities-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">03 / Study priorities</p>
          <h2 id="dashboard-priorities-title" className="mt-1 font-display text-xl font-semibold text-white">Where to focus</h2>
        </div>
        <Link to="/plan" className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-cyan-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          Study Plan <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {gate.loading || loading ? (
        <Card className="border-white/10 bg-white/[0.025]"><CardContent role="status" className="space-y-3 p-5">
          <span className="sr-only">Loading study priorities</span>
          <div className="h-4 w-2/5 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
          <div className="h-12 rounded-lg bg-white/5 motion-reduce:animate-none" />
        </CardContent></Card>
      ) : !gate.canAccessStudyPlan ? (
        <UpgradePrompt feature="AI Study Plan" description="Open the Study Plan to see available access options." variant="card" />
      ) : error ? (
        <Card className="border-rose-300/20 bg-white/[0.025]"><CardContent role="alert" className="space-y-3 p-5">
          <p className="font-medium text-white">Study priorities could not load</p>
          <p className="text-sm leading-6 text-slate-400">{error}</p>
          <Button variant="outline" onClick={refresh} className="min-h-11"><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
        </CardContent></Card>
      ) : priorities.length === 0 ? (
        <Card className="border-dashed border-white/15 bg-white/[0.025]"><CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-1 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-white">No study priorities yet</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">Start your first MCQ session to build a recorded performance baseline. No priority is inferred without subject data.</p>
            </div>
          </div>
          <Button asChild className="min-h-11 w-full sm:w-auto"><Link to="/practice">Start your first session <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </CardContent></Card>
      ) : (
        <Card className="border-white/10 bg-white/[0.025]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">{usingSavedPlan ? 'Saved plan priorities' : 'Priorities from recorded subject accuracy'}</CardTitle>
            {!usingSavedPlan && <p className="text-xs leading-5 text-slate-500">These priorities summarize recorded subject results. They are not a generated schedule.</p>}
          </CardHeader>
          <CardContent className="space-y-2">
            {priorities.slice(0, 3).map((priority, index) => (
              <div key={priority.category + index} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/10 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={priorityTone(priority.priority)}>{priority.priority}</Badge><h3 className="font-medium text-white">{priority.category}</h3></div>
                  {priority.study_tip && <p className="mt-1 text-sm leading-5 text-slate-400">{priority.study_tip}</p>}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  {priority.accuracy != null && <span className="text-sm tabular-nums text-slate-400">{priority.attempt_count != null ? priority.attempt_count + ' attempts · ' : ''}{priority.accuracy}% recorded accuracy</span>}
                  {priority.attempt_count != null && priority.attempt_count < 5 && <Badge variant="outline" className="border-amber-300/25 text-amber-200">Small sample</Badge>}
                  {priority.daily_questions != null && <span className="text-sm tabular-nums text-slate-400">{priority.daily_questions} q/day</span>}
                  <Button asChild size="sm" variant="outline" className="min-h-10 shrink-0"><Link to={'/practice?subject=' + encodeURIComponent(priority.category)}>Practice <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-slate-500">Showing up to three priorities. <Link to="/plan" className="underline underline-offset-4 hover:text-slate-300">Open the full plan</Link> for the saved weekly schedule and generation controls.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
