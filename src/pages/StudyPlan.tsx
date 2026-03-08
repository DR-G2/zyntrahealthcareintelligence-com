import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Target,
  Calendar,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { StudyPlanSkeleton } from '@/components/skeletons/PageSkeleton';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';

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

interface AIScheduleDay {
  day: string;
  total_questions: number;
  topics: { category: string; count: number; focus_note: string }[];
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

function getReadinessLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Exam Ready', color: 'text-green-500' };
  if (score >= 60) return { label: 'Almost There', color: 'text-yellow-500' };
  if (score >= 40) return { label: 'Building Up', color: 'text-orange-500' };
  return { label: 'Early Stage', color: 'text-red-500' };
}

export default function StudyPlan() {
  const { user, profile } = useAuth();
  const [perfProfile, setPerfProfile] = useState<PerformanceProfile | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiPlan, setAiPlan] = useState<AIPlan | null>(null);
  const [generating, setGenerating] = useState(false);

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

      // Load cached AI plan
      if (planRes.data?.tasks) {
        try {
          const cached = planRes.data.tasks as unknown as AIPlan;
          if (cached.weekly_schedule && cached.recommendations) setAiPlan(cached);
        } catch { /* ignore bad data */ }
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
    return differenceInDays(new Date(profile.exam_date), new Date());
  }, [profile?.exam_date]);

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
      toast.success('AI study plan generated!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate study plan');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <StudyPlanSkeleton />
      </AppLayout>
    );
  }

  const readiness = perfProfile?.readiness_score ?? 0;
  const readinessInfo = getReadinessLabel(readiness);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Study Plan</h1>
            <p className="text-muted-foreground">
              {daysUntilExam !== null && daysUntilExam > 0
                ? `${daysUntilExam} days until your exam`
                : 'Set your exam date in Settings to see a countdown'}
            </p>
          </div>
          <Button onClick={generateAIPlan} disabled={generating || categoryStats.length === 0} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiPlan ? 'Regenerate AI Plan' : 'Generate AI Plan'}
          </Button>
        </div>

        {/* AI Motivation */}
        {aiPlan?.motivation && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{aiPlan.motivation}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Readiness Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Readiness Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-bold font-display">{readiness}%</div>
                <div className={`text-sm font-medium ${readinessInfo.color}`}>{readinessInfo.label}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Accuracy</div>
                  <div className="font-semibold">{perfProfile?.clinical_accuracy ?? 0}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stability</div>
                  <div className="font-semibold">{perfProfile?.stability_score ?? 0}%</div>
                </div>
              </div>
            </div>
            <Progress value={readiness} className="h-2" />
          </CardContent>
        </Card>

        {/* AI Focus Areas or Data-driven */}
        {(aiPlan?.focus_areas || categoryStats.length > 0) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> Focus Areas
                {aiPlan?.focus_areas && <Badge variant="secondary" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> AI</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(aiPlan?.focus_areas || categoryStats).map((item: any) => (
                  <div key={item.category} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Badge
                        variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'secondary' : 'outline'}
                        className="shrink-0 text-xs"
                      >
                        {item.priority === 'high' ? 'High' : item.priority === 'medium' ? 'Medium' : 'Maintain'}
                      </Badge>
                      <span className="text-sm font-medium truncate">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {item.accuracy !== undefined && (
                        <>
                          <Progress value={item.accuracy} className="h-2 w-24" />
                          <span className="text-sm text-muted-foreground w-10 text-right">{item.accuracy}%</span>
                        </>
                      )}
                      {item.daily_questions && (
                        <span className="text-xs text-muted-foreground">{item.daily_questions}q/day</span>
                      )}
                    </div>
                  </div>
                ))}
                {aiPlan?.focus_areas && aiPlan.focus_areas.some(f => f.study_tip || f.spaced_repetition_note) && (
                  <div className="mt-4 space-y-2">
                    {aiPlan.focus_areas.filter(f => f.study_tip || f.spaced_repetition_note).map((f, i) => (
                      <div key={i} className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 space-y-1">
                        <div><strong>{f.category}:</strong> {f.study_tip}</div>
                        {f.spaced_repetition_note && (
                          <div className="flex items-center gap-1 text-primary/70">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{f.spaced_repetition_note}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Schedule */}
        {aiPlan?.weekly_schedule && aiPlan.weekly_schedule.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Weekly Schedule
                <Badge variant="secondary" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> AI</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {aiPlan.weekly_schedule.map((day) => (
                  <div key={day.day} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{day.day}</span>
                      <span className="text-xs text-muted-foreground">{day.total_questions} Qs</span>
                    </div>
                    {day.topics.map((t) => (
                      <div key={t.category} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate">{t.category}</span>
                          <span className="font-medium">{t.count}</span>
                        </div>
                        {t.focus_note && (
                          <p className="text-[10px] text-muted-foreground/70 italic">{t.focus_note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Recommendations or Static */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" /> Recommended Actions
              {aiPlan?.recommendations && <Badge variant="secondary" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> AI</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiPlan?.recommendations ? (
                aiPlan.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <Lightbulb className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium">{rec.tip}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>Complete practice sessions to get AI-powered recommendations.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {categoryStats.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">Complete a diagnostic or practice session to generate your study plan.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
