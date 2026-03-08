import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Target,
  Calendar,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { differenceInDays, format, addDays } from 'date-fns';

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [perfRes, attemptsRes] = await Promise.all([
        supabase
          .from('performance_profiles')
          .select('readiness_score, clinical_accuracy, stability_score, time_sensitivity, confidence_gap')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('user_attempts')
          .select('is_correct, questions(category)')
          .eq('user_id', user.id),
      ]);

      if (perfRes.data) setPerfProfile(perfRes.data);

      // Build category stats
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

  const weeklySchedule = useMemo(() => {
    const highPriority = categoryStats.filter((c) => c.priority === 'high');
    const medPriority = categoryStats.filter((c) => c.priority === 'medium');
    const allFocus = [...highPriority, ...medPriority];
    if (allFocus.length === 0) return [];

    return DAYS.map((day, i) => {
      const isWeekend = i >= 5;
      const dailyCount = isWeekend ? 30 : 20;
      const topics: { category: string; count: number }[] = [];

      if (allFocus.length === 1) {
        topics.push({ category: allFocus[0].category, count: dailyCount });
      } else {
        // Rotate through focus areas, heavier on high priority
        const idx = i % allFocus.length;
        const primary = allFocus[idx];
        const secondary = allFocus[(idx + 1) % allFocus.length];
        const primaryCount = primary.priority === 'high' ? Math.ceil(dailyCount * 0.6) : Math.ceil(dailyCount * 0.5);
        topics.push({ category: primary.category, count: primaryCount });
        topics.push({ category: secondary.category, count: dailyCount - primaryCount });
      }

      return { day, totalQuestions: dailyCount, topics };
    });
  }, [categoryStats]);

  const recommendations = useMemo(() => {
    const tips: { icon: typeof AlertTriangle; text: string }[] = [];
    if (!perfProfile) return tips;

    if ((perfProfile.stability_score ?? 100) < 60) {
      tips.push({ icon: AlertTriangle, text: 'Your answer stability is low. Practice in "No Change" mode to build decisiveness.' });
    }
    if ((perfProfile.time_sensitivity ?? 100) < 60) {
      tips.push({ icon: Clock, text: 'You tend to spend too long on questions. Do timed drills with strict limits.' });
    }
    if ((perfProfile.confidence_gap ?? 0) > 30) {
      tips.push({ icon: Target, text: 'There\'s a big gap between your strongest and weakest categories. Focus on levelling up weak areas.' });
    }
    if ((perfProfile.clinical_accuracy ?? 0) < 50) {
      tips.push({ icon: TrendingUp, text: 'Clinical accuracy needs work. Review explanations carefully after each session.' });
    }
    if (tips.length === 0) {
      tips.push({ icon: CheckCircle2, text: 'Keep up the good work! Maintain your practice consistency.' });
    }
    return tips;
  }, [perfProfile]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const readiness = perfProfile?.readiness_score ?? 0;
  const readinessInfo = getReadinessLabel(readiness);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Study Plan</h1>
          <p className="text-muted-foreground">
            {daysUntilExam !== null && daysUntilExam > 0
              ? `${daysUntilExam} days until your exam`
              : 'Set your exam date in Settings to see a countdown'}
          </p>
        </div>

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

        {/* Focus Areas */}
        {categoryStats.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryStats.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Badge
                        variant={cat.priority === 'high' ? 'destructive' : cat.priority === 'medium' ? 'secondary' : 'outline'}
                        className="shrink-0 text-xs"
                      >
                        {cat.priority === 'high' ? 'High' : cat.priority === 'medium' ? 'Medium' : 'Maintain'}
                      </Badge>
                      <span className="text-sm font-medium truncate">{cat.category}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Progress value={cat.accuracy} className="h-2 w-24" />
                      <span className="text-sm text-muted-foreground w-10 text-right">{cat.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Schedule */}
        {weeklySchedule.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Weekly Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {weeklySchedule.map((day) => (
                  <div
                    key={day.day}
                    className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{day.day}</span>
                      <span className="text-xs text-muted-foreground">{day.totalQuestions} Qs</span>
                    </div>
                    {day.topics.map((t) => (
                      <div key={t.category} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate">{t.category}</span>
                        <span className="font-medium">{t.count}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommended Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" /> Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <rec.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>{rec.text}</span>
                </div>
              ))}
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
