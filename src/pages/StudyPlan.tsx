import { useEffect, useMemo, useState, type SVGProps } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { SubscriptionTimer } from '@/components/SubscriptionTimer';
import { differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, Clock, Lightbulb, Loader2, Sparkles, Target, TrendingUp, ArrowRight } from 'lucide-react';

interface PerformanceProfile { readiness_score: number | null; clinical_accuracy: number | null; stability_score: number | null; time_sensitivity: number | null; confidence_gap: number | null; }
interface CategoryStat { category: string; correct: number; total: number; accuracy: number; priority: 'high' | 'medium' | 'maintain'; }
interface StudyTask { category: string; priority: 'high' | 'medium' | 'maintain' | string; daily_questions?: number; accuracy?: number; study_tip?: string; spaced_repetition_note?: string; }
interface AIScheduleDay { day: string; total_questions: number; topics: { category: string; count: number; focus_note: string }[]; }
interface AIRecommendation { tip: string; reason: string; }
interface AIPlan { focus_areas: StudyTask[]; weekly_schedule: AIScheduleDay[]; recommendations: AIRecommendation[]; motivation: string; }

function priorityTone(priority: string) {
  if (priority === 'high') return 'border-rose-400/20 bg-rose-400/10 text-rose-300';
  if (priority === 'medium') return 'border-purple-400/20 bg-purple-400/10 text-purple-300';
  return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
}

export default function StudyPlan() {
  const { user, profile } = useAuth();
  const gate = useFeatureGate();
  const [perfProfile, setPerfProfile] = useState<PerformanceProfile | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [aiPlan, setAiPlan] = useState<AIPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchData = async () => {
      const [perfRes, attemptsRes, planRes] = await Promise.all([
        supabase.from('performance_profiles').select('readiness_score, clinical_accuracy, stability_score, time_sensitivity, confidence_gap').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_attempts').select('is_correct, questions(category)').eq('user_id', user.id),
        supabase.from('study_plans').select('tasks').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (perfRes.data) setPerfProfile(perfRes.data);
      if (planRes.data?.tasks) {
        const cached = planRes.data.tasks as unknown as AIPlan;
        if (cached?.weekly_schedule && cached?.recommendations) setAiPlan(cached);
      }
      const map = new Map<string, { correct: number; total: number }>();
      (attemptsRes.data || []).forEach((a: any) => {
        const category = a.questions?.category || 'Uncategorised';
        const entry = map.get(category) || { correct: 0, total: 0 };
        entry.total += 1;
        if (a.is_correct) entry.correct += 1;
        map.set(category, entry);
      });
      const stats = Array.from(map.entries()).map(([category, d]) => {
        const accuracy = Math.round((d.correct / d.total) * 100);
        return { category, ...d, accuracy, priority: accuracy < 60 ? 'high' : accuracy < 80 ? 'medium' : 'maintain' } as CategoryStat;
      }).sort((a, b) => a.accuracy - b.accuracy);
      setCategoryStats(stats);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const daysUntilExam = useMemo(() => profile?.exam_date ? differenceInDays(new Date(profile.exam_date), new Date()) : null, [profile?.exam_date]);

  const generateAIPlan = async () => {
    if (!user || generating) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ categoryStats, perfProfile, examDate: profile?.exam_date, daysUntilExam, weakAreas: profile?.weak_areas }),
      });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({ error: 'Failed to generate plan' }))).error);
      setAiPlan(await resp.json());
      toast.success('Study plan generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate study plan');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <AppLayout><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-40 rounded-3xl bg-white/5" /><div className="h-48 rounded-3xl bg-white/5" /></div></AppLayout>;

  if (!gate.canAccessStudyPlan) {
    return <AppLayout><div className="mx-auto max-w-xl py-16"><UpgradePrompt feature="AI Study Plan" description="Generate a focused roadmap from your recorded performance signals." /></div></AppLayout>;
  }

  const readiness = Math.max(0, Math.min(100, Number(perfProfile?.readiness_score || 0)));
  const accuracy = Number(perfProfile?.clinical_accuracy || 0);
  const stability = Number(perfProfile?.stability_score || 0);
  const targetDelta = Math.max(0, 80 - readiness);
  const tasks: StudyTask[] = aiPlan?.focus_areas?.length ? aiPlan.focus_areas : categoryStats.map(s => ({ category: s.category, priority: s.priority, accuracy: s.accuracy, daily_questions: Math.max(10, Math.round((100 - s.accuracy) / 5)) }));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <SubscriptionTimer />

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl sm:p-7">
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.14em] text-cyan-300"><Target className="h-3.5 w-3.5" /> Study Plan</div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Study Plan</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Convert performance signals into your next training priorities.</p>
            </div>
            <button onClick={generateAIPlan} disabled={generating || categoryStats.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiPlan ? 'Regenerate Plan' : 'Generate Plan'}
            </button>
          </div>
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
        </div>

        {(aiPlan?.motivation || categoryStats.length > 0) && (
          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.045] p-5">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
              <div>
                <p className="text-sm font-medium text-slate-200">{aiPlan?.motivation || 'Your latest performance signals are ready to be converted into focused training.'}</p>
                <p className="mt-1 text-xs text-slate-500">Recommendations are generated from recorded practice data.</p>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Current Readiness', value: `${Math.round(readiness)}%`, helper: 'Composite signal', icon: TrendingUp, accent: 'text-cyan-300' },
            { label: 'Target Delta', value: `${Math.round(targetDelta)} pts`, helper: 'Distance to 80', icon: Target, accent: 'text-purple-300' },
            { label: 'Stability Index', value: stability ? `${Math.round(stability)}%` : '—', helper: 'Answer consistency', icon: ActivityIcon, accent: 'text-emerald-300' },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
              <item.icon className={`h-5 w-5 ${item.accent}`} />
              <p className="mt-5 text-xs text-slate-500">{item.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold text-white">{item.value}</p>
              <p className="mt-1 text-[11px] font-mono text-slate-600">{item.helper}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Priority Actions</h2>
              <p className="mt-1 text-xs text-slate-500">Focus the next block of questions where the signal says it matters.</p>
            </div>
            <span className="text-xs font-mono text-slate-600">{tasks.length} priorities</span>
          </div>
          <div className="space-y-3">
            {tasks.slice(0, 8).map((task, index) => (
              <div key={`${task.category}-${index}`} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', priorityTone(task.priority))}>{task.priority === 'maintain' ? 'Maintain' : task.priority}</span>
                    <p className="truncate text-sm font-medium text-slate-200">{task.category}</p>
                  </div>
                  {task.study_tip && <p className="mt-2 text-xs leading-5 text-slate-500">{task.study_tip}</p>}
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-white">{task.daily_questions || 0} q/day</p>
                  {task.accuracy !== undefined && <p className="text-[11px] font-mono text-slate-600">{task.accuracy}% accuracy</p>}
                </div>
                <Link to="/practice" className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-300">Practice <ArrowRight className="h-3 w-3" /></Link>
              </div>
            ))}
            {tasks.length === 0 && <div className="py-12 text-center text-sm text-slate-500">Complete a practice session to populate priorities.</div>}
          </div>
        </section>

        {aiPlan?.weekly_schedule?.length ? (
          <section className="rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-2"><Calendar className="h-5 w-5 text-purple-300" /><h2 className="font-display text-xl font-semibold text-white">Weekly Rhythm</h2></div>
            <div className="grid gap-3 md:grid-cols-3">
              {aiPlan.weekly_schedule.slice(0, 6).map(day => (
                <div key={day.day} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-200">{day.day}</span><span className="text-xs font-mono text-slate-500">{day.total_questions} q</span></div>
                  <div className="mt-3 space-y-2">{day.topics.slice(0, 4).map(topic => <div key={topic.category} className="flex items-center justify-between text-xs"><span className="truncate text-slate-500">{topic.category}</span><span className="text-slate-300">{topic.count}</span></div>)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-300" /><h2 className="font-display text-xl font-semibold text-white">Recommendations</h2></div>
          {aiPlan?.recommendations?.length ? (
            <div className="space-y-3">{aiPlan.recommendations.map((rec, i) => <div key={i} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><div><p className="text-sm text-slate-200">{rec.tip}</p><p className="mt-1 text-xs text-slate-500">{rec.reason}</p></div></div>)}</div>
          ) : <p className="text-sm text-slate-500">Generate a plan after enough practice data has accumulated.</p>}
        </section>
      </div>
    </AppLayout>
  );
}

function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}><path d="M3 12h4l2-7 4 14 2-7h6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
