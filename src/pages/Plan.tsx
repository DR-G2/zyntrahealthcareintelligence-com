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

function priorityTone(priority: string) {
  if (priority === 'high') return 'border-rose-400/20 bg-rose-400/10 text-rose-300';
  if (priority === 'medium') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
  return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
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

  const tab = params.get('tab') === 'generate' ? 'generate' : 'current';

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const [perfRes, attemptsRes, planRes] = await Promise.all([
        supabase.from('readiness_dna').select('readiness_score, clinical_accuracy, answer_stability, time_management').eq('user_id', user.id).maybeSingle(),
        supabase.from('subject_dna').select('subject, accuracy, attempt_count').eq('user_id', user.id).order('accuracy', { ascending: true }),
        supabase.from('study_plans').select('tasks, generated_at').eq('user_id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (perfRes.data) setPerf(perfRes.data);
      if (planRes.data?.generated_at) setGeneratedAt(planRes.data.generated_at);
      if (planRes.data?.tasks) {
        const cached = planRes.data.tasks as unknown as AIPlan;
        if (cached?.focus_areas && cached?.weekly_schedule) setPlan(cached);
      }

      setCategories((attemptsRes.data || []).map((row: any) => {
        const accuracy = Math.round(Number(row.accuracy || 0));
        const total = Number(row.attempt_count || 0);
        return {
          category: row.subject || 'Uncategorised',
          correct: Math.round(total * accuracy / 100),
          total,
          accuracy,
          priority: accuracy < 60 ? 'high' : accuracy < 80 ? 'medium' : 'maintain',
        };
      }).filter((row: CategoryStat) => row.total > 0));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

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

  const readiness = Math.max(0, Math.min(100, Number(perf?.readiness_score || 0)));
  const accuracy = Math.max(0, Math.min(100, Number(perf?.clinical_accuracy || 0)));
  const stability = Math.max(0, Math.min(100, Number(perf?.answer_stability || 0)));

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

  if (loading) {
    return <AppLayout><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-44 rounded-3xl bg-white/5" /><div className="h-64 rounded-3xl bg-white/5" /></div></AppLayout>;
  }

  if (!gate.canAccessStudyPlan) {
    return <AppLayout><div className="mx-auto max-w-xl py-16"><UpgradePrompt feature="AI Study Plan" description="Generate a focused roadmap from your recorded performance signals." /></div></AppLayout>;
  }

  const tasks = plan?.focus_areas?.length
    ? plan.focus_areas
    : categories.map(c => ({ category: c.category, priority: c.priority, accuracy: c.accuracy, daily_questions: Math.max(10, Math.round((100 - c.accuracy) / 5)) }));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <SubscriptionTimer />
        <RoomHeader kind="study-plan" />

        {tab === 'generate' ? (
          <section className="rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-cyan-300"><Sparkles className="h-5 w-5" /><span className="text-sm font-semibold">Generate New Plan</span></div>
                <h2 className="mt-2 font-display text-2xl font-semibold text-white">Build from what Zyntra knows now.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">The generator uses your recorded performance, weaknesses, answer stability, timing, confidence signals, behaviour patterns, progress and exam date. It does not invent a separate readiness model.</p>
              </div>
              <button onClick={generatePlan} disabled={generating || generationLocked || categories.length === 0} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generationLocked ? 'Monthly limit reached' : 'Generate plan'}
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Readiness', `${Math.round(readiness)}%`],
                ['Accuracy', `${Math.round(accuracy)}%`],
                ['Stability', `${Math.round(stability)}%`],
                ['Exam horizon', daysUntilExam == null ? 'Not set' : `${Math.max(0, daysUntilExam)} days`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            {generationLocked ? (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div><p className="text-sm font-medium text-slate-200">Monthly generation used</p><p className="mt-1 text-xs leading-5 text-slate-500">One successful study-plan generation is allowed per calendar month. Next generation available in {nextGenerationDays} day{nextGenerationDays === 1 ? '' : 's'}.</p></div>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <div><p className="text-sm font-medium text-slate-200">What feeds the plan</p><p className="mt-1 text-xs leading-5 text-slate-500">Performance Intelligence → priorities → daily training → new attempts → updated intelligence.</p></div>
              </div>
            )}
          </section>
        ) : (
          <>
            {!plan ? (
              <section className="rounded-3xl border border-white/10 bg-[#081224]/70 p-8 text-center backdrop-blur-xl">
                <CalendarDays className="mx-auto h-7 w-7 text-cyan-300" />
                <h2 className="mt-4 font-display text-xl font-semibold text-white">No active plan yet</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Complete practice to build performance signals, then generate your first 7-day roadmap.</p>
                <button onClick={() => setParams({ tab: 'generate' })} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] px-4 py-2.5 text-sm font-semibold text-cyan-200">Generate New <ArrowRight className="h-4 w-4" /></button>
              </section>
            ) : (
              <>
                {plan.motivation && <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.045] p-5"><div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" /><p className="text-sm leading-6 text-slate-200">{plan.motivation}</p></div></div>}

                <section className="grid gap-4 md:grid-cols-3">
                  {[
                    ['Current Readiness', `${Math.round(readiness)}%`, 'Composite signal', TrendingUp],
                    ['Clinical Accuracy', `${Math.round(accuracy)}%`, 'Recorded MCQ performance', Target],
                    ['Answer Stability', `${Math.round(stability)}%`, 'Consistency of decisions', CheckCircle2],
                  ].map(([label, value, helper, Icon]) => (
                    <div key={String(label)} className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
                      <Icon className="h-5 w-5 text-cyan-300" />
                      <p className="mt-5 text-xs text-slate-500">{label}</p>
                      <p className="mt-1 font-display text-3xl font-semibold text-white">{value}</p>
                      <p className="mt-1 text-[11px] font-mono text-slate-600">{helper}</p>
                    </div>
                  ))}
                </section>

                <section className="rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl">
                  <div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="font-display text-xl font-semibold text-white">Next Training Priorities</h2><p className="mt-1 text-xs text-slate-500">Start with the areas where your current signal shows the largest need for reinforcement.</p></div><span className="text-xs font-mono text-slate-600">{tasks.length} priorities</span></div>
                  <div className="space-y-3">
                    {tasks.slice(0, 8).map((task, i) => (
                      <div key={task.category + i} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', priorityTone(task.priority))}>{task.priority}</span><p className="truncate text-sm font-medium text-slate-200">{task.category}</p></div>{task.study_tip && <p className="mt-2 text-xs leading-5 text-slate-500">{task.study_tip}</p>}</div>
                        <div><p className="text-sm font-semibold text-white">{task.daily_questions || 0} q/day</p>{task.accuracy != null && <p className="text-[11px] font-mono text-slate-600">{task.accuracy}% accuracy</p>}</div>
                        <Link to={`/practice?subject=${encodeURIComponent(task.category)}`} className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-400/30 hover:text-cyan-300">Practice <ArrowRight className="h-3 w-3" /></Link>
                      </div>
                    ))}
                  </div>
                </section>

                {plan.weekly_schedule?.length > 0 && <section className="rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl"><div className="mb-5 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-purple-300" /><h2 className="font-display text-xl font-semibold text-white">Weekly Rhythm</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{plan.weekly_schedule.slice(0, 7).map(day => <div key={day.day} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-200">{day.day}</span><span className="text-xs font-mono text-slate-500">{day.total_questions} q</span></div><div className="mt-3 space-y-2">{day.topics.slice(0, 4).map(topic => <div key={topic.category} className="flex items-center justify-between text-xs"><span className="truncate text-slate-500">{topic.category}</span><span className="text-slate-300">{topic.count}</span></div>)}</div></div>)}</div></section>}

                <section className="rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl"><div className="mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-300" /><h2 className="font-display text-xl font-semibold text-white">Review & Reinforcement</h2></div><p className="text-sm text-slate-400">Use Flashcards to reinforce mistakes and weak areas surfaced by your plan.</p><Link to="/flashcards" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open Flashcards <ArrowRight className="h-4 w-4" /></Link></section>
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
