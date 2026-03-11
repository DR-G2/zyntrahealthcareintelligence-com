import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Clock, Shield, Brain, ArrowRight, TrendingUp, Stethoscope, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileSkeleton } from '@/components/skeletons/PageSkeleton';

interface PerformanceData {
  stability_score: number | null;
  time_sensitivity: number | null;
  confidence_gap: number | null;
  clinical_accuracy: number | null;
  readiness_score: number | null;
}

interface StationAttempt {
  id: string;
  subject: string;
  scores: any;
  time_taken_seconds: number;
  mode: string;
  created_at: string;
}

function ScoreRing({ value, label, icon: Icon, color }: {
  value: number;
  label: string;
  icon: React.ElementType;
  color: string;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="100" height="100" className="-rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <motion.circle
            cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="h-4 w-4 mb-0.5" style={{ color }} />
          <span className="text-lg font-bold font-display">{value}</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export default function Profile() {
  const location = useLocation();
  const { user } = useAuth();
  const stateData = (location.state as any)?.performanceData as PerformanceData | undefined;
  const [data, setData] = useState<PerformanceData | undefined>(stateData);
  const [loading, setLoading] = useState(!stateData);
  const [stationAttempts, setStationAttempts] = useState<StationAttempt[]>([]);
  const [mcqAttempts, setMcqAttempts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [profileRes, stationsRes, mcqRes] = await Promise.all([
        supabase.from('performance_profiles')
          .select('stability_score, time_sensitivity, confidence_gap, clinical_accuracy, readiness_score')
          .eq('user_id', user.id).maybeSingle(),
        supabase.from('station_attempts')
          .select('id, subject, scores, time_taken_seconds, mode, created_at')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('user_attempts')
          .select('id, is_correct, answer_changes_count, change_sequence, selected_answer, questions(correct_answer)')
          .eq('user_id', user.id).limit(500),
      ]);
      if (profileRes.data) setData(profileRes.data as any);
      setStationAttempts(stationsRes.data || []);
      setMcqAttempts(mcqRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  // OSCE stats
  const osceStats = useMemo(() => {
    if (stationAttempts.length === 0) return null;
    const totalScore = stationAttempts.reduce((s, a) => s + (typeof (a.scores as any)?.total === 'number' ? (a.scores as any).total : 0), 0);
    const avgScore = Math.round(totalScore / stationAttempts.length);
    const avgTime = Math.round(stationAttempts.reduce((s, a) => s + a.time_taken_seconds, 0) / stationAttempts.length);

    const bySubject: Record<string, { total: number; count: number }> = {};
    stationAttempts.forEach(a => {
      const subj = a.subject || 'Unknown';
      if (!bySubject[subj]) bySubject[subj] = { total: 0, count: 0 };
      bySubject[subj].total += typeof (a.scores as any)?.total === 'number' ? (a.scores as any).total : 0;
      bySubject[subj].count++;
    });

    return { avgScore, avgTime, count: stationAttempts.length, bySubject };
  }, [stationAttempts]);

  // Trust Your Gut stats
  const gutStats = useMemo(() => {
    const withChanges = mcqAttempts.filter(a => a.answer_changes_count > 0 && Array.isArray(a.change_sequence) && a.change_sequence.length > 0);
    if (withChanges.length === 0) return null;
    let firstCorrect = 0;
    let correctToWrong = 0;
    withChanges.forEach(a => {
      const first = a.change_sequence[0];
      const correct = a.questions?.correct_answer;
      if (first === correct) {
        firstCorrect++;
        if (a.selected_answer !== correct) correctToWrong++;
      }
    });
    return {
      firstInstinctAccuracy: Math.round((firstCorrect / withChanges.length) * 100),
      pointsLost: correctToWrong,
      totalWithChanges: withChanges.length,
    };
  }, [mcqAttempts]);

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!data && !osceStats && !gutStats) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <Card>
            <CardContent className="py-12 space-y-4">
              <Target className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <h2 className="text-xl font-display font-bold">No Performance Profile Yet</h2>
              <p className="text-muted-foreground">Complete a diagnostic assessment or OSCE station to generate your profile.</p>
              <div className="flex gap-3 justify-center">
                <Button asChild className="gap-1">
                  <Link to="/assess">Take MCQ Diagnostic <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="gap-1">
                  <Link to="/stations">Try OSCE Station <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const readiness = data?.readiness_score ?? 0;
  const readinessColor = readiness >= 70 ? 'hsl(var(--success))' : readiness >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  const metrics = [
    { value: data?.stability_score ?? 0, label: 'Answer Stability', icon: Shield, color: 'hsl(var(--chart-1))', desc: 'How often you change answers. Higher = more decisive.' },
    { value: data?.time_sensitivity ?? 0, label: 'Time Management', icon: Clock, color: 'hsl(var(--chart-2))', desc: 'How well you manage time pressure.' },
    { value: 100 - (data?.confidence_gap ?? 0), label: 'Confidence Calibration', icon: Brain, color: 'hsl(var(--chart-3))', desc: 'How well your confidence matches your accuracy.' },
    { value: data?.clinical_accuracy ?? 0, label: 'Clinical Accuracy', icon: Target, color: 'hsl(var(--chart-4))', desc: 'Raw percentage of correct answers.' },
  ];

  const getReadinessLabel = (score: number) => {
    if (score >= 80) return 'Exam Ready';
    if (score >= 60) return 'Almost There';
    if (score >= 40) return 'Building Up';
    return 'Early Stage';
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold font-display">Performance Profile</h1>
          <p className="text-muted-foreground mt-1">Unified readiness breakdown across MCQ, OSCE & Trust Your Gut</p>
        </motion.div>

        <Tabs defaultValue="combined" className="w-full">
          <TabsList>
            <TabsTrigger value="combined">Combined</TabsTrigger>
            <TabsTrigger value="mcq">MCQ</TabsTrigger>
            <TabsTrigger value="osce">OSCE</TabsTrigger>
            <TabsTrigger value="gut">Trust Your Gut</TabsTrigger>
          </TabsList>

          {/* Combined / MCQ Tab */}
          {['combined', 'mcq'].map(tab => (
            <TabsContent key={tab} value={tab} className="space-y-6">
              {/* Readiness Score */}
              {data && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Overall Readiness
                      </CardTitle>
                      <CardDescription>Composite score across all behavioral dimensions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <svg width="120" height="120" className="-rotate-90">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                            <motion.circle
                              cx="60" cy="60" r="50" fill="none" stroke={readinessColor} strokeWidth="8" strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 50}
                              initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                              animate={{ strokeDashoffset: 2 * Math.PI * 50 - (readiness / 100) * 2 * Math.PI * 50 }}
                              transition={{ duration: 1.2, ease: 'easeOut' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold font-display">{readiness}</span>
                            <span className="text-xs text-muted-foreground">/ 100</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-lg font-bold" style={{ color: readinessColor }}>{getReadinessLabel(readiness)}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {readiness >= 70 ? 'Strong performance across most dimensions.' : readiness >= 40 ? 'Solid foundation with room for improvement.' : 'Focus on building core exam skills.'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Score Rings */}
              {data && (
                <Card>
                  <CardHeader>
                    <CardTitle>Behavioral Dimensions</CardTitle>
                    <CardDescription>Each score reflects a different aspect of exam performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                      {metrics.map(m => <ScoreRing key={m.label} {...m} />)}
                    </div>
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {metrics.map(m => (
                        <div key={m.label} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                          <m.icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: m.color }} />
                          <div>
                            <p className="text-sm font-medium">{m.label}: {m.value}/100</p>
                            <p className="text-xs text-muted-foreground">{m.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* OSCE Summary (combined tab only) */}
              {tab === 'combined' && osceStats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-primary" />
                      OSCE Performance
                    </CardTitle>
                    <CardDescription>{osceStats.count} stations completed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display">{osceStats.avgScore}%</p>
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display">{Math.round(osceStats.avgTime / 60)}m</p>
                        <p className="text-xs text-muted-foreground">Avg Time</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display">{osceStats.count}</p>
                        <p className="text-xs text-muted-foreground">Stations</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Trust Your Gut Summary (combined tab only) */}
              {tab === 'combined' && gutStats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Trust Your Gut
                    </CardTitle>
                    <CardDescription>First-instinct analysis across {gutStats.totalWithChanges} changed answers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display text-primary">{gutStats.firstInstinctAccuracy}%</p>
                        <p className="text-xs text-muted-foreground">First Instinct Accuracy</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display text-destructive">{gutStats.pointsLost}</p>
                        <p className="text-xs text-muted-foreground">Points Lost</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display">{gutStats.totalWithChanges}</p>
                        <p className="text-xs text-muted-foreground">Changed Answers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}

          {/* OSCE Tab */}
          <TabsContent value="osce" className="space-y-6">
            {osceStats ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-primary" />
                      OSCE Performance
                    </CardTitle>
                    <CardDescription>{osceStats.count} stations completed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display">{osceStats.avgScore}%</p>
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display">{Math.round(osceStats.avgTime / 60)}m</p>
                        <p className="text-xs text-muted-foreground">Avg Time</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold font-display">{osceStats.count}</p>
                        <p className="text-xs text-muted-foreground">Stations</p>
                      </div>
                    </div>
                    {/* Subject breakdown */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium">By Subject</p>
                      {Object.entries(osceStats.bySubject)
                        .sort(([, a], [, b]) => (b.total / b.count) - (a.total / a.count))
                        .map(([subj, s]) => {
                          const avg = Math.round(s.total / s.count);
                          return (
                            <div key={subj} className="flex items-center gap-4">
                              <div className="w-36 truncate text-sm">{subj}</div>
                              <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', avg >= 70 ? 'bg-success' : avg >= 50 ? 'bg-warning' : 'bg-destructive')}
                                  style={{ width: `${avg}%` }}
                                />
                              </div>
                              <span className="text-sm font-mono w-12 text-right">{avg}%</span>
                              <Badge variant="outline" className="text-xs">{s.count} stations</Badge>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <Stethoscope className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                  <h2 className="text-xl font-display font-bold">No OSCE Data Yet</h2>
                  <p className="text-muted-foreground">Complete some OSCE stations to see your performance here.</p>
                  <Button asChild className="gap-1">
                    <Link to="/stations">Start OSCE Practice <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Trust Your Gut Tab */}
          <TabsContent value="gut" className="space-y-6">
            {gutStats ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Trust Your Gut Analysis
                  </CardTitle>
                  <CardDescription>Analysis of {gutStats.totalWithChanges} answers where you changed your selection</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-muted/50 p-4 text-center">
                      <p className="text-3xl font-bold font-display text-primary">{gutStats.firstInstinctAccuracy}%</p>
                      <p className="text-xs text-muted-foreground mt-1">First Instinct Accuracy</p>
                    </div>
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 text-center">
                      <p className="text-3xl font-bold font-display text-destructive">{gutStats.pointsLost}</p>
                      <p className="text-xs text-muted-foreground mt-1">Points Lost from Changes</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4 text-center">
                      <p className="text-3xl font-bold font-display">{gutStats.totalWithChanges}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Changed Answers</p>
                    </div>
                  </div>
                  {gutStats.firstInstinctAccuracy > 60 && gutStats.pointsLost > 0 && (
                    <div className="rounded-lg bg-warning/5 border border-warning/20 p-4">
                      <p className="text-sm font-medium text-warning">⚠️ Your first instinct is right {gutStats.firstInstinctAccuracy}% of the time, but you lost {gutStats.pointsLost} points by changing correct answers. Trust your gut more!</p>
                    </div>
                  )}
                  <Button asChild className="gap-1">
                    <Link to="/trust-your-gut">Go to Trust Your Gut Training <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <Target className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                  <h2 className="text-xl font-display font-bold">No Gut Instinct Data Yet</h2>
                  <p className="text-muted-foreground">Complete some practice questions to see first-instinct analysis.</p>
                  <Button asChild className="gap-1">
                    <Link to="/practice">Start Practice <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button asChild className="gap-1">
            <Link to="/practice">Start Targeted Practice <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/behavior">View Behavior Analysis</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/assess">Retake Diagnostic</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
