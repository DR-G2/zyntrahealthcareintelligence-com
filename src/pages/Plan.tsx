import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Loader2, Sparkles, Target, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { RoomHeader } from '@/components/RoomHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { SubscriptionTimer } from '@/components/SubscriptionTimer';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PerformanceProfile {
  readiness_score: number | null;
  clinical_accuracy: number | null;
  answer_stability: number | null;
  time_management: number | null;
}
interface CategoryStat {
  category: string;
  correct: number;
  total: number;
  accuracy: number;
  priority: 'high' | 'medium' | 'maintain';
}
interface StudyTask {
  category: string;
  priority: string;
  daily_questions?: number;
  accuracy?: number;
  study_tip?: string;
  spaced_repetition_note?: string;
}
interface AIScheduleDay {
  day: string;
  total_questions: number;
  topics: { category: string; count: number; focus_note: string }[];
}
interface AIPlan {
  focus_areas: StudyTask[];
  weekly_schedule: AIScheduleDay[];
  recommendations: { tip: string; reason: string }[];
  motivation: string;
}

export function formatPlanMetric(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? 'Unavailable' : `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}
export function isValidPlan(value: unknown): value is AIPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<AIPlan>;
  return Array.isArray(plan.focus_areas) && plan.focus_areas.every(task => task && typeof task.category === 'string' && typeof task.priority === 'string')
    && Array.isArray(plan.weekly_schedule) && plan.weekly_schedule.every(day => day && typeof day.day === 'string' && Number.isFinite(day.total_questions)
      && Array.isArray(day.topics) && day.topics.every(topic => topic && typeof topic.category === 'string' && Number.isFinite(topic.count)));
}

function priorityTone(priority: string) {
  if (priority === 'high') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (priority === 'medium') return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-success/30 bg-success/10 text-success';
}

export default function Plan() {
  const { user, profile } = useAuth();
  const gate = useFeatureGate();
  const [params, setParams] = useSearchParams();
  const [perf, setPerf] = useState<PerformanceProfile | null>(null);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [plan, setPlan] = useState<AIPlan | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const tab = params.get('tab') === 'generate' ? 'generate' : 'current';

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setLoadError(null); setPerf(null); setCategories([]); setPlan(null); setGeneratedAt(null);
    (async () => {
      try {
      const [perfRes, attemptsRes, planRes] = await Promise.all([
        supabase.from('readiness_dna').select('readiness_score, clinical_accuracy, answer_stability, time_management').eq('user_id', user.id).maybeSingle(),
        supabase.from('subject_dna').select('subject, accuracy, attempt_count').eq('user_id', user.id).order('accuracy', { ascending: true }),
        supabase.from('study_plans').select('tasks, generated_at').eq('user_id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const readError = perfRes.error || attemptsRes.error || planRes.error;
      if (readError) throw new Error(readError.message);
      if (perfRes.data) setPerf(perfRes.data);
      if (planRes.data?.generated_at) setGeneratedAt(planRes.data.generated_at);
      if (planRes.data?.tasks) {
        const cached = planRes.data.tasks as unknown as AIPlan;
        if (!isValidPlan(cached)) throw new Error('The saved plan could not be read. Please retry before generating another plan.');
        setPlan(cached);
      }

      setCategories((attemptsRes.data || []).map((row: any) => {
        const accuracy = Math.round(Number(row.accuracy || 0));
        const total = Number(row.attempt_count || 0);
        return {
          category: row.subject || 'Uncategorised',
          correct: Math.round(total * accuracy / 100),
          total,
          accuracy,
          priority: (accuracy < 60 ? 'high' : accuracy < 80 ? 'medium' : 'maintain') as CategoryStat['priority'],
        };
      }).filter((row: CategoryStat) => row.total > 0));
      } catch (error) {
        if (!cancelled) { setPlan(null); setPerf(null); setCategories([]); setLoadError(error instanceof Error ? error.message : 'Study Plan could not load.'); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user, retry]);

  const daysUntilExam = useMemo(
    () => profile?.exam_date ? differenceInDays(new Date(profile.exam_date), new Date()) : null,
    [profile?.exam_date]
  );

  const generationLocked = useMemo(() => {
    if (!generatedAt) return false;
    const d = new Date(generatedAt);
    const now = new Date();
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
  }, [generatedAt]);

  const nextGenerationDays = useMemo(() => {
    if (!generationLocked) return null;
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86400000));
  }, [generationLocked]);

  const readiness = formatPlanMetric(perf?.readiness_score);
  const accuracy = formatPlanMetric(perf?.clinical_accuracy);
  const stability = formatPlanMetric(perf?.answer_stability);

  const generatePlan = async () => {
    if (!user || generating || generationLocked || categories.length === 0) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          categoryStats: categories,
          perfProfile: perf,
          examDate: profile?.exam_date,
          daysUntilExam,
          weakAreas: profile?.weak_areas,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.generated_at) setGeneratedAt(body.generated_at);
        throw new Error(body.error || 'Failed to generate study plan');
      }
      if (!isValidPlan(body)) throw new Error('The generated plan could not be displayed. Please reload to check the saved plan.');
      setPlan(body);
      if (body.generated_at) setGeneratedAt(body.generated_at);
      setParams({ tab: 'current' });
      toast.success('Study plan generated');
    } catch (error: any) {
      const message = error?.message || 'Failed to generate study plan';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <AppLayout><div role="status" className="mx-auto max-w-6xl space-y-6"><p className="text-sm text-muted-foreground">Loading your plan…</p><div className="h-32 rounded-lg bg-muted animate-pulse" /><div className="h-64 rounded-lg bg-muted animate-pulse" /></div></AppLayout>;

  if (!gate.canAccessStudyPlan) {
    return <AppLayout><div className="mx-auto max-w-xl py-16"><UpgradePrompt feature="AI Study Plan" description="Generate a focused roadmap from your recorded performance signals." /></div></AppLayout>;
  }

  if (loadError) return <AppLayout><div className="mx-auto max-w-6xl space-y-6"><RoomHeader kind="study-plan" compact /><section role="alert" className="py-8"><h2 className="text-xl font-semibold">Study Plan could not load</h2><p className="mt-3 text-sm text-muted-foreground">{loadError}</p><Button variant="outline" className="mt-5" onClick={() => setRetry(n => n + 1)}>Retry</Button></section></div></AppLayout>;

  const tasks = plan?.focus_areas?.length
    ? plan.focus_areas
    : categories.map(c => ({ category: c.category, priority: c.priority, accuracy: c.accuracy, daily_questions: Math.max(10, Math.round((100 - c.accuracy) / 5)) }));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <SubscriptionTimer />
        <RoomHeader kind="study-plan" compact />

        {tab === 'generate' ? (
          <section className="training-band pb-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5" /><span className="text-sm font-semibold">Generate New Plan</span></div>
                <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">Build from what Zyntra knows now.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">The generator uses your recorded performance, weaknesses, answer stability, timing, confidence signals, behaviour patterns, progress and exam date. It does not invent a separate readiness model.</p>
              </div>
              <Button onClick={generatePlan} disabled={generating || generationLocked || categories.length === 0} className="min-h-12 shrink-0">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generationLocked ? 'Monthly limit reached' : 'Generate plan'}
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Readiness', `${readiness}`],
                ['Accuracy', `${accuracy}`],
                ['Stability', `${stability}`],
                ['Exam horizon', daysUntilExam == null ? 'Not set' : `${Math.max(0, daysUntilExam)} days`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/60 bg-secondary p-4">
                  <p className="text-xs  text-muted-foreground">{label}</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {generationLocked ? (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div><p className="text-sm font-medium text-foreground">Monthly generation used</p><p className="mt-1 text-xs leading-5 text-muted-foreground">One successful study-plan generation is allowed per calendar month. Next generation available in {nextGenerationDays} day{nextGenerationDays === 1 ? '' : 's'}.</p></div>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-primary/30 bg-accent p-4">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div><p className="text-sm font-medium text-foreground">What feeds the plan</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Performance Intelligence → priorities → daily training → new attempts → updated intelligence.</p></div>
              </div>
            )}
          </section>
        ) : (
          <>
            {!plan ? (
              <section className="py-12 text-center">
                <CalendarDays className="mx-auto h-7 w-7 text-primary" />
                <h2 className="mt-4 font-display text-xl font-semibold text-foreground">No active plan yet</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Complete practice to build performance signals, then generate your first 7-day roadmap.</p>
                <Button variant="outline" onClick={() => setParams({ tab: 'generate' })} className="mt-5 min-h-11">Generate New <ArrowRight className="h-4 w-4" /></Button>
              </section>
            ) : (
              <>
                {plan.focus_areas[0] && <section className="grid gap-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-medium text-primary">First plan priority</p><h2 className="mt-3 font-display text-2xl font-medium">{plan.focus_areas[0].category}</h2>{plan.focus_areas[0].study_tip && <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{plan.focus_areas[0].study_tip}</p>}</div><Button asChild className="min-h-12"><Link to="/practice">Open practice <ArrowRight className="h-4 w-4" /></Link></Button></section>}
                {plan.motivation && <div className="border-l-2 border-primary/50 pl-5 py-2"><div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-sm leading-6 text-foreground">{plan.motivation}</p></div></div>}

                <section className="grid gap-4 md:grid-cols-3">
                  {([
                    ['Current Readiness', `${readiness}`, 'Composite signal', TrendingUp],
                    ['Clinical Accuracy', `${accuracy}`, 'Recorded MCQ performance', Target],
                    ['Answer Stability', `${stability}`, 'Consistency of decisions', CheckCircle2],
                  ] as [string, string, string, typeof TrendingUp][]).map(([label, value, helper, Icon]) => (
                    <div key={String(label)} className="border-t border-border/60 py-5">
                      <Icon className="h-5 w-5 text-primary" />
                      <p className="mt-5 text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-display text-3xl font-semibold text-foreground">{value}</p>
                      <p className="mt-1 text-xs font-mono text-muted-foreground">{helper}</p>
                    </div>
                  ))}
                </section>

                <section className="training-band pb-6">
                  <div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="font-display text-xl font-semibold text-foreground">Plan priorities</h2><p className="mt-1 text-xs text-muted-foreground">Priorities from your saved plan. Practice currently selects across topics.</p></div><span className="text-xs font-mono text-muted-foreground">{tasks.length} priorities</span></div>{!plan.focus_areas.length && <p className="mb-4 text-sm text-muted-foreground">No saved focus areas. These priorities are estimated from your recorded subject accuracy, not scheduled tasks.</p>}
                  <div className="space-y-3">
                    {tasks.map((task, i) => (
                      <div key={task.category + i} className="grid gap-4 rounded-lg border border-border/60 bg-secondary p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold ', priorityTone(task.priority))}>{task.priority}</span><p className="truncate text-sm font-medium text-foreground">{task.category}</p></div>{task.study_tip && <p className="mt-2 text-xs leading-5 text-muted-foreground">{task.study_tip}</p>}</div>
                        <div><p className="text-sm font-semibold text-foreground">{task.daily_questions || 0} q/day</p>{task.accuracy != null && <p className="text-xs font-mono text-muted-foreground">{task.accuracy}% accuracy</p>}</div>
                        <Button asChild variant="outline"><Link to={`/practice?subject=${encodeURIComponent(task.category)}`}>Open practice <ArrowRight className="h-4 w-4" /></Link></Button>
                      </div>
                    ))}
                  </div>
                </section>

                {plan.weekly_schedule.length > 0 && <section className="training-band"><h2 className="font-display text-xl font-semibold">Weekly plan</h2><ol className="mt-6 divide-y divide-border/60">{plan.weekly_schedule.map((day, index) => <li key={day.day + index} className="grid gap-4 py-5 sm:grid-cols-[8rem_1fr]"><div><p className="font-semibold">{day.day}</p><p className="mt-1 text-sm text-muted-foreground">{day.total_questions} questions</p></div><ul className="space-y-4">{day.topics.map((topic, i) => <li key={topic.category + i}><div className="flex items-start justify-between gap-3"><span className="text-sm font-medium">{topic.category}</span><span className="shrink-0 text-sm text-muted-foreground">{topic.count} questions</span></div>{topic.focus_note && <p className="mt-1 text-sm leading-6 text-muted-foreground">{topic.focus_note}</p>}</li>)}</ul></li>)}</ol></section>}


                <section className="training-band pb-6"><div className="mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" /><h2 className="font-display text-xl font-semibold text-foreground">Review & Reinforcement</h2></div><p className="text-sm text-muted-foreground">Use Flashcards to reinforce mistakes and weak areas surfaced by your plan.</p><Link to="/flashcards" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary">Open Flashcards <ArrowRight className="h-4 w-4" /></Link></section>
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
