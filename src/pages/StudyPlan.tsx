import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { RoomHeader } from '@/components/RoomHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Target,
  Calendar,
  Lightbulb,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  ArrowRight,
  Play,
  Brain,
  ListChecks,
  BookOpen,
  Activity,
} from 'lucide-react';
import { differenceInDays, format, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { StudyPlanSkeleton } from '@/components/skeletons/PageSkeleton';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { SubscriptionTimer } from '@/components/SubscriptionTimer';

interface PerformanceProfile {
  readiness_score: number | null;
  clinical_accuracy: number | null;
  stability_score: number | null;
  time_sensitivity: number | null;
  confidence_gap: number | null;
}

interface CategoryStat {
  category: string;
  correct: number;
  total: number;
  accuracy: number;
  priority: 'high' | 'medium' | 'maintain';
}

interface AIFocusArea {
  category: string;
  priority: string;
  daily_questions: number;
  study_tip: string;
  spaced_repetition_note?: string;
}

interface AITopic {
  category: string;
  count: number;
  focus_note: string;
}

interface AIScheduleDay {
  day: string;
  total_questions: number;
  topics: AITopic[];
}

interface AIRecommendation {
  tip: string;
  reason: string;
}

interface AIPlan {
  focus_areas: AIFocusArea[];
  weekly_schedule: AIScheduleDay[];
  recommendations: AIRecommendation[];
  motivation: string;
}

type Task = {
  id: string;
  time: string;
  duration: number;
  title: string;
  subject?: string;
  quantity?: number;
  type: 'mcq' | 'flashcards' | 'performance' | 'behaviour' | 'trust' | 'review';
  reason: string;
  status: 'upcoming' | 'ready' | 'completed';
  href: string;
  cta: string;
};

function getReadinessLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Exam Ready', color: 'text-green-500' };
  if (score >= 60) return { label: 'Almost There', color: 'text-yellow-500' };
  if (score >= 40) return { label: 'Building Up', color: 'text-orange-500' };
  return { label: 'Early Stage', color: 'text-red-500' };
}

function clampScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildTaskHref(category?: string, count = 20) {
  if (!category) return '/practice';
  return '/practice?planSubject=' + encodeURIComponent(category) + '&planCount=' + encodeURIComponent(String(count));
}

function buildTasks(
  plan: AIPlan | null,
  categoryStats: CategoryStat[],
  perfProfile: PerformanceProfile | null,
  today: Date,
): Task[] {
  const weakest = categoryStats[0];
  const secondWeakest = categoryStats[1];
  const behaviourRisk = perfProfile?.stability_score !== null && perfProfile?.stability_score !== undefined
    ? perfProfile.stability_score < 70
    : false;
  const todayPlan = plan?.weekly_schedule?.find((d) => {
    const dayLabel = d.day.toLowerCase();
    return dayLabel === format(today, 'EEE').toLowerCase()
      || dayLabel === format(today, 'EEEE').toLowerCase();
  }) ?? plan?.weekly_schedule?.[0];

  const primaryCategory = weakest?.category || todayPlan?.topics?.[0]?.category || 'Mixed practice';
  const primaryCount = Math.max(10, Math.min(40, todayPlan?.topics?.[0]?.count || weakest?.total || 20));
  const secondaryCategory = secondWeakest?.category || todayPlan?.topics?.[1]?.category || weakest?.category;
  const secondaryCount = Math.max(10, Math.min(30, todayPlan?.topics?.[1]?.count || 15));

  const tasks: Task[] = [
    {
      id: 'primary-mcq',
      time: '09:00',
      duration: primaryCount,
      title: 'Train ' + primaryCategory,
      subject: primaryCategory,
      quantity: primaryCount,
      type: 'mcq',
      reason: weakest
        ? 'This is currently your lowest-performing recorded category.'
        : 'Start with targeted clinical practice while Zyntra builds your profile.',
      status: 'ready',
      href: buildTaskHref(primaryCategory, primaryCount),
      cta: 'Start ' + primaryCount + ' Questions',
    },
    {
      id: 'mistake-review',
      time: '10:00',
      duration: 20,
      title: 'Review recent mistakes',
      type: 'flashcards',
      reason: 'Reinforce concepts exposed by recent incorrect answers.',
      status: 'upcoming',
      href: '/flashcards',
      cta: 'Review Flashcards',
    },
    {
      id: 'secondary-mcq',
      time: '11:00',
      duration: secondaryCount,
      title: 'Reinforce ' + (secondaryCategory || 'your next weak area'),
      subject: secondaryCategory,
      quantity: secondaryCount,
      type: 'mcq',
      reason: secondWeakest
        ? 'Your next-largest recorded gap sits here.'
        : 'Keep a second clinical area active while broader data accumulates.',
      status: 'upcoming',
      href: buildTaskHref(secondaryCategory, secondaryCount),
      cta: 'Start Training',
    },
    ...(behaviourRisk ? [{
      id: 'behaviour',
      time: '17:00',
      duration: 15,
      title: 'Train decision stability',
      type: 'behaviour' as const,
      reason: 'Your stability signal suggests answer-decision consistency needs attention.',
      status: 'upcoming' as const,
      href: '/intelligence?tab=behavior',
      cta: 'Open Behaviour',
    }] : []),
    {
      id: 'daily-review',
      time: behaviourRisk ? '20:30' : '17:00',
      duration: 15,
      title: 'Review today\'s performance',
      type: 'performance',
      reason: 'Use the latest training data to decide tomorrow\'s priority.',
      status: 'upcoming',
      href: '/intelligence?tab=performance',
      cta: 'Open Performance',
    },
  ];

  return tasks;
}

export default function StudyPlan() {
  const { user, profile } = useAuth();
  const gate = useFeatureGate();
  const [perfProfile, setPerfProfile] = useState<PerformanceProfile | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiPlan, setAiPlan] = useState<AIPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [perfRes, attemptsRes, planRes] = await Promise.all([
        supabase
          .from('performance_profiles')
          .select('readiness_score, clinical_accuracy, stability_score, time_sensitivity, confidence_gap')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('user_attempts')
          .select('is_correct, questions(category)')
          .eq('user_id', user.id),
        supabase
          .from('study_plans')
          .select('tasks')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (perfRes.data) setPerfProfile(perfRes.data);

      if (planRes.data?.tasks) {
        try {
          const cached = planRes.data.tasks as unknown as AIPlan;
          if (cached.weekly_schedule && cached.recommendations) setAiPlan(cached);
        } catch {
          // Ignore malformed legacy plan payloads.
        }
      }

      const catMap = new Map<string, { correct: number; total: number }>();
      (attemptsRes.data || []).forEach((a: any) => {
        const cat = a.questions?.category || 'Unknown';
        const entry = catMap.get(cat) || { correct: 0, total: 0 };
        entry.total++;
        if (a.is_correct) entry.correct++;
        catMap.set(cat, entry);
      });

      const stats: CategoryStat[] = Array.from(catMap.entries()).map(([category, d]) => {
        const accuracy = Math.round((d.correct / d.total) * 100);
        const priority: CategoryStat['priority'] =
          accuracy < 60 ? 'high' : accuracy < 80 ? 'medium' : 'maintain';
        return { category, ...d, accuracy, priority };
      });
      stats.sort((a, b) => a.accuracy - b.accuracy);
      setCategoryStats(stats);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const daysUntilExam = useMemo(() => {
    if (!profile?.exam_date) return null;
    return differenceInDays(parseISO(profile.exam_date), new Date());
  }, [profile?.exam_date]);

  const planPhase = useMemo(() => {
    if (daysUntilExam === null) return 'Build your plan around your current data';
    if (daysUntilExam > 30) return 'Build + repair';
    if (daysUntilExam > 14) return 'Consolidate + intensify';
    if (daysUntilExam > 7) return 'Exam conditioning';
    if (daysUntilExam >= 0) return 'Final consolidation';
    return 'Exam date has passed';
  }, [daysUntilExam]);

  const generateAIPlan = async () => {
    if (!user || generating) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          categoryStats,
          perfProfile,
          examDate: profile?.exam_date,
          daysUntilExam,
          weakAreas: profile?.weak_areas,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to generate plan' }));
        throw new Error(err.error);
      }

      const plan = await resp.json();
      setAiPlan(plan);
      toast.success('AI study plan generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate study plan');
    } finally {
      setGenerating(false);
    }
  };

  const today = new Date();
  const tasks = useMemo(() => buildTasks(aiPlan, categoryStats, perfProfile, today), [aiPlan, categoryStats, perfProfile]);

  const selectedDayTasks = useMemo(() => {
    if (isSameDay(selectedDay, today)) return tasks;
    const dayLabel = format(selectedDay, 'EEEE').toLowerCase();
    const scheduled = aiPlan?.weekly_schedule?.find((d) => {
      const label = d.day.toLowerCase();
      return label === dayLabel || label === format(selectedDay, 'EEE').toLowerCase();
    });
    if (!scheduled) return [];
    return scheduled.topics.map((topic, index) => ({
      id: `scheduled-${topic.category}-${index}`,
      time: index === 0 ? '09:00' : index === 1 ? '11:00' : '15:00',
      duration: Math.max(10, Math.min(60, topic.count)),
      title: 'Train ' + topic.category,
      subject: topic.category,
      quantity: topic.count,
      type: 'mcq' as const,
      reason: topic.focus_note || 'Scheduled from your current personalized focus.',
      status: 'upcoming' as const,
      href: buildTaskHref(topic.category, topic.count),
      cta: 'Start Training',
    }));
  }, [selectedDay, today, tasks, aiPlan]);

  const readiness = clampScore(perfProfile?.readiness_score);
  const accuracy = clampScore(perfProfile?.clinical_accuracy);
  const stability = clampScore(perfProfile?.stability_score);
  const readinessInfo = readiness === null ? null : getReadinessLabel(readiness);
  const completedCount = 0;
  const plannedMinutes = tasks.reduce((sum, task) => sum + task.duration, 0);
  const examCountdown = daysUntilExam !== null ? Math.max(0, daysUntilExam) : null;

  if (loading) {
    return (
      <AppLayout>
        <StudyPlanSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {!gate.canAccessStudyPlan ? (
        <div className="mx-auto max-w-xl py-12">
          <UpgradePrompt feature="AI Study Plan" description="Get a personalized study plan generated by AI. Available on any paid plan." />
        </div>
      ) : (
        <div className="mx-auto max-w-6xl space-y-6">
          <SubscriptionTimer />
          <RoomHeader kind="study-plan" className="mb-2" />

          <div className="grid gap-4 lg:grid-cols-[1.45fr_.85fr]">
            <Card className="overflow-hidden border-primary/20 bg-card/95">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Today</div>
                    <div className="mt-1 flex flex-wrap items-end gap-3">
                      <h2 className="font-display text-3xl font-bold sm:text-4xl">Your training plan</h2>
                      {examCountdown !== null && (
                        <Badge variant="secondary" className="mb-1 gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {examCountdown} {examCountdown === 1 ? 'day' : 'days'} to exam
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {planPhase}. Zyntra turns your latest performance signals into concrete training actions.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={generateAIPlan} disabled={generating || categoryStats.length === 0} className="gap-2">
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {aiPlan ? 'Refresh plan' : 'Generate plan'}
                    </Button>
                    {!profile?.exam_date && (
                      <Button asChild variant="outline">
                        <Link to="/settings">Set exam date</Link>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Planned today</div>
                    <div className="mt-1 font-display text-2xl font-semibold">{Math.round(plannedMinutes / 60)}h {plannedMinutes % 60}m</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Readiness</div>
                    <div className="mt-1 font-display text-2xl font-semibold">{readiness === null ? 'Building' : `${readiness}%`}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Priority</div>
                    <div className="mt-1 font-display text-2xl font-semibold">{categoryStats[0]?.category || 'Data building'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary/10">
              <CardHeader className="pb-2">
                <CardTitle className="font-display flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" /> Next Best Action
                </CardTitle>
                <CardDescription>Do not decide what to study next. Zyntra has already ranked it.</CardDescription>
              </CardHeader>
              <CardContent>
                {tasks[0] ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-primary">{tasks[0].time} · {tasks[0].duration} min</div>
                      <h3 className="mt-1 font-display text-xl font-bold">{tasks[0].title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{tasks[0].reason}</p>
                    </div>
                    <Button asChild size="lg" className="w-full gap-2">
                      <Link to={tasks[0].href}>
                        {tasks[0].cta} <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
                    Complete more practice so Zyntra can choose a precise next action.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.55fr_.75fr]">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" /> Today\'s timeline
                    </CardTitle>
                    <CardDescription>Each block is designed to be started, not merely read.</CardDescription>
                  </div>
                  <Badge variant="outline">{tasks.length} actions</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedDayTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    No scheduled tasks for this day yet.
                  </div>
                ) : selectedDayTasks.map((task) => (
                  <div key={task.id} className="group rounded-2xl border border-border/70 bg-card/60 p-4 transition hover:border-primary/40 hover:bg-primary/5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="w-14 shrink-0">
                          <div className="text-sm font-semibold">{task.time}</div>
                          <div className="text-[11px] text-muted-foreground">{task.duration} min</div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={task.type === 'behaviour' ? 'secondary' : 'outline'}>{task.type}</Badge>
                            <h3 className="font-semibold">{task.title}</h3>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.reason}</p>
                        </div>
                      </div>
                      <Button asChild variant={task.status === 'ready' ? 'default' : 'outline'} className="w-full gap-2 sm:w-auto">
                        <Link to={task.href}>
                          <ArrowRight className="h-4 w-4" /> {task.cta}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" /> Week at a glance
                </CardTitle>
                <CardDescription>Select a day to inspect its training blocks.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const date = new Date(today);
                    date.setDate(today.getDate() + index);
                    const active = isSameDay(date, selectedDay);
                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => setSelectedDay(date)}
                        className={`rounded-lg border p-2 text-center transition ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 hover:border-primary/30'}`}
                        aria-pressed={active}
                      >
                        <div className="text-[10px] uppercase text-muted-foreground">{format(date, 'EEE')}</div>
                        <div className="mt-1 font-display text-sm font-semibold">{format(date, 'd')}</div>
                      </button>
                    );
                  })}
                </div>
                {aiPlan?.weekly_schedule?.length ? (
                  <div className="mt-4 space-y-2">
                    {aiPlan.weekly_schedule.slice(0, 4).map((day) => (
                      <div key={day.day} className="rounded-lg border border-border/60 bg-background/20 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{day.day}</span>
                          <span className="text-xs text-muted-foreground">{day.total_questions} Qs</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {day.topics.slice(0, 3).map((topic) => (
                            <Badge key={topic.category} variant="outline" className="text-[10px]">
                              {topic.category} · {topic.count}q
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                    Generate the plan to populate your week.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Performance → Plan
              </CardTitle>
              <CardDescription>The loop that keeps the timetable adaptive.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  ['Performance', accuracy === null ? 'Building data' : accuracy + '% accuracy', '/intelligence?tab=performance', Brain],
                  ['Weakness', categoryStats[0]?.category || 'Not enough data', '/intelligence?tab=performance', Target],
                  ['Priority', categoryStats[0]?.priority || 'Data building', '/plan', ListChecks],
                  ['Training', categoryStats[0] ? categoryStats[0].category + ' · ' + Math.min(40, Math.max(10, categoryStats[0].total)) + 'q' : 'Start practice', '/practice', BookOpen],
                  ['Next signal', stability === null ? 'Awaiting more data' : 'Stability ' + stability + '%', '/intelligence?tab=behavior', TrendingUp],
                ].map(([label, value, href, Icon]) => (
                  <Link key={String(label)} to={String(href)} className="rounded-xl border border-border/70 bg-background/20 p-4 transition hover:border-primary/40 hover:bg-primary/5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      {(() => { const C = Icon as React.ElementType; return <C className="h-4 w-4" />; })()}
                      {String(label)}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{String(value)}</div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" /> Why this plan
              </CardTitle>
              <CardDescription>
                {categoryStats.length ? 'Your plan is weighted toward the areas currently showing the largest recorded gaps.' : 'Zyntra needs more training data before it can personalize your plan precisely.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Performance</div>
                <div className="mt-1 text-sm font-semibold">{accuracy === null ? 'Not available yet' : accuracy + '% clinical accuracy'}</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Behaviour</div>
                <div className="mt-1 text-sm font-semibold">{stability === null ? 'Not available yet' : stability + '% stability'}</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Exam timing</div>
                <div className="mt-1 text-sm font-semibold">{examCountdown === null ? 'Set your exam date' : examCountdown + ' days remaining'}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
