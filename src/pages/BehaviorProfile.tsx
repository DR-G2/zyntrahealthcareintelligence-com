import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BehaviorSkeleton } from '@/components/skeletons/PageSkeleton';
import {
  Brain, AlertTriangle, Zap, Clock, Shield, Target,
  TrendingUp, TrendingDown, ArrowRight, RefreshCw, Activity,
  CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';

const ARCHETYPE_META: Record<string, { label: string; icon: typeof Brain; color: string; risk: string; description: string }> = {
  panic_changer: {
    label: 'The Panic Changer',
    icon: AlertTriangle,
    color: 'hsl(var(--destructive))',
    risk: 'High',
    description: 'You change answers frequently under pressure. Your first instinct is often correct, but anxiety drives you to second-guess.',
  },
  rusher: {
    label: 'The Rusher',
    icon: Zap,
    color: 'hsl(var(--warning))',
    risk: 'Medium',
    description: 'You answer too quickly, missing subtle clues in complex stems. Speed is good, but not at the cost of accuracy.',
  },
  paralyzer: {
    label: 'The Paralyzer',
    icon: Clock,
    color: 'hsl(var(--destructive))',
    risk: 'High',
    description: 'You spend too long on each question, leading to time pressure later. Decision paralysis costs you marks through incomplete blocks.',
  },
  strategist: {
    label: 'The Strategist',
    icon: Target,
    color: 'hsl(var(--success))',
    risk: 'Low',
    description: 'You demonstrate optimal exam behavior: systematic elimination, deliberate changes, and consistent pacing. Keep it up!',
  },
  fatigue_victim: {
    label: 'The Fatigue Victim',
    icon: TrendingDown,
    color: 'hsl(var(--destructive))',
    risk: 'High',
    description: 'Your performance drops significantly in later questions. The AMC is 3.5 hours — endurance training is critical.',
  },
  subject_avoider: {
    label: 'The Subject Avoider',
    icon: Shield,
    color: 'hsl(var(--warning))',
    risk: 'Medium',
    description: 'You show panic patterns in specific subjects. This is a knowledge gap masked as behavioral anxiety.',
  },
};

interface BehaviorData {
  archetype: string;
  archetype_signals: any;
  block_performance: Record<string, { accuracy: number; avgTime: number; changeRate: number }>;
  subject_patterns: Record<string, { accuracy: number; changeRate: number; avgTime: number; total: number; type: string }>;
  trap_flags: Array<{ trap: string; description: string; severity: string }>;
  predicted_score_low: number | null;
  predicted_score_high: number | null;
  predicted_score_potential: number | null;
  recommendations: Array<{ title: string; description: string; priority: string; action_link?: string }>;
}

export default function BehaviorProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const gate = useFeatureGate();
  const [data, setData] = useState<BehaviorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const [osceStats, setOsceStats] = useState<{ count: number; avgScore: number; subjects: string[] } | null>(null);
  const [psychograph, setPsychograph] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [profileRes, stationsRes, psychRes] = await Promise.all([
        supabase.from('behavior_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('station_attempts').select('subject, scores, time_taken_seconds').eq('user_id', user.id).limit(200),
        supabase.from('psychograph_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      ]);
      if (profileRes.data) setData(profileRes.data as any);

      const stations = stationsRes.data || [];
      if (stations.length > 0) {
        const totalScore = stations.reduce((s, a) => s + (typeof (a.scores as any)?.total === 'number' ? (a.scores as any).total : 0), 0);
        const subjects = [...new Set(stations.map(s => s.subject))];
        setOsceStats({ count: stations.length, avgScore: Math.round(totalScore / stations.length), subjects });
      }

      if (psychRes.data && psychRes.data.length > 0) {
        setPsychograph(psychRes.data[0]);
      }

      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('analyze-behavior');
      if (error) throw error;
      // Refetch profile
      const { data: profile } = await supabase
        .from('behavior_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (profile) setData(profile as any);
      toast({ title: 'Analysis complete', description: 'Your behavior profile has been updated.' });
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message || 'Try again later', variant: 'destructive' });
    }
    setAnalyzing(false);
  };

  if (!gate.canAccessBehavior) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <UpgradePrompt feature="Behavior Analysis" description="AI-powered exam behavior profiling is a paid feature. Upgrade to see your archetype, trap detection, and personalized recommendations." />
      </div>
    );
  }

  if (loading) {
    return <BehaviorSkeleton />;
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <Card>
            <CardContent className="py-12 space-y-4">
              <Brain className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <h2 className="text-xl font-display font-bold">No Behavior Profile Yet</h2>
              <p className="text-muted-foreground">Complete some practice sessions, then run the analysis.</p>
              <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link to="/practice">Start Practice</Link>
                </Button>
                <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                  Run Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const meta = ARCHETYPE_META[data.archetype] || ARCHETYPE_META.strategist;
  const ArchIcon = meta.icon;

  // Prepare block chart data
  const blockChartData = Object.entries(data.block_performance || {}).map(([key, val]) => ({
    name: key,
    accuracy: val.accuracy,
    avgTime: val.avgTime,
    changeRate: val.changeRate,
  }));

  // Prepare subject radar data
  const subjectData = Object.entries(data.subject_patterns || {}).map(([cat, s]) => ({
    subject: cat.length > 12 ? cat.slice(0, 12) + '…' : cat,
    accuracy: s.accuracy,
    changeRate: s.changeRate,
  }));

  const signals = data.archetype_signals || {};

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Behavior Analysis</h1>
            <p className="text-muted-foreground mt-1">AI-powered exam behavior profiling</p>
          </div>
          <Button onClick={runAnalysis} disabled={analyzing} variant="outline" className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-analyze
          </Button>
        </motion.div>

        {/* Archetype Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-l-4" style={{ borderLeftColor: meta.color }}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${meta.color}20` }}>
                  <ArchIcon className="h-7 w-7" style={{ color: meta.color }} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-display">{meta.label}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={meta.risk === 'Low' ? 'default' : meta.risk === 'High' ? 'destructive' : 'secondary'}>
                      AMC Risk: {meta.risk}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{meta.description}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Key Stats Row */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Avg Time/Q', value: `${signals.avgTime || 0}s`, icon: Clock },
              { label: 'Change Rate', value: `${Math.round((signals.changeRate || 0) * 100)}%`, icon: RefreshCw },
              { label: 'Accuracy', value: `${Math.round((signals.correctRate || 0) * 100)}%`, icon: Target },
              { label: 'Fatigue Factor', value: `${Math.round((signals.fatigueIncrease || 1) * 100 - 100)}%`, icon: TrendingDown },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <stat.icon className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold font-display">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Predicted Score */}
        {data.predicted_score_low && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Predicted AMC Score
                </CardTitle>
                <CardDescription>Based on behavioral patterns and accuracy data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <div className="flex-1">
                    <div className="relative h-8 rounded-full bg-muted overflow-hidden">
                      {/* Pass line at 230/300 */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10" style={{ left: `${(230 / 300) * 100}%` }} />
                      {/* Current range */}
                      <div
                        className="absolute top-0 bottom-0 rounded-full bg-primary/30"
                        style={{
                          left: `${((data.predicted_score_low || 0) / 300) * 100}%`,
                          width: `${(((data.predicted_score_high || 0) - (data.predicted_score_low || 0)) / 300) * 100}%`,
                        }}
                      />
                      {/* Potential */}
                      <div
                        className="absolute top-1 bottom-1 w-1 rounded-full bg-success"
                        style={{ left: `${((data.predicted_score_potential || 0) / 300) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>0</span>
                      <span className="text-foreground/50">Pass: 230</span>
                      <span>300</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm">Current: <span className="font-bold text-primary">{data.predicted_score_low}–{data.predicted_score_high}</span></p>
                    <p className="text-sm">Potential: <span className="font-bold text-success">{data.predicted_score_potential}</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Block Performance Chart */}
        {blockChartData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <CardHeader>
                <CardTitle>Block Performance</CardTitle>
                <CardDescription>How your performance changes across question segments</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={blockChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Bar dataKey="accuracy" name="Accuracy %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="changeRate" name="Change Rate %" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Subject Patterns */}
        {subjectData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle>Subject Analysis</CardTitle>
                <CardDescription>Behavioral vs knowledge weaknesses by topic</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(data.subject_patterns || {})
                    .sort(([, a], [, b]) => a.accuracy - b.accuracy)
                    .map(([cat, s]) => (
                      <div key={cat} className="flex items-center gap-4">
                        <div className="w-36 truncate text-sm font-medium">{cat}</div>
                        <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden relative">
                          <div
                            className={cn('h-full rounded-full', s.accuracy >= 70 ? 'bg-success' : s.accuracy >= 50 ? 'bg-warning' : 'bg-destructive')}
                            style={{ width: `${s.accuracy}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono w-12 text-right">{s.accuracy}%</span>
                        <Badge variant="outline" className="text-xs w-24 justify-center">
                          {s.type === 'behavioral' ? '🧠 Behavioral' : s.type === 'knowledge' ? '📚 Knowledge' : '✅ Stable'}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* AMC Trap Detection */}
        {(data.trap_flags || []).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  AMC Trap Detection
                </CardTitle>
                <CardDescription>Common exam traps detected in your behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.trap_flags.map((trap, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className={cn(
                      'mt-0.5 h-2 w-2 rounded-full shrink-0',
                      trap.severity === 'high' ? 'bg-destructive' : trap.severity === 'medium' ? 'bg-warning' : 'bg-muted-foreground'
                    )} />
                    <div>
                      <p className="text-sm font-medium">{trap.trap.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{trap.description}</p>
                    </div>
                    <Badge variant={trap.severity === 'high' ? 'destructive' : 'secondary'} className="ml-auto shrink-0 text-xs">
                      {trap.severity}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recommendations */}
        {(data.recommendations as any[])?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Personalized action plan based on your behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.recommendations as any[]).map((rec: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                      rec.priority === 'high' ? 'bg-destructive/10 text-destructive' : rec.priority === 'medium' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                    )}>
                      {rec.priority === 'high' ? <AlertTriangle className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                    </div>
                    {rec.action_link && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={rec.action_link}>Go</Link>
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* OSCE + Psychograph Summary */}
        {(osceStats || psychograph) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  OSCE Behavioral Insights
                </CardTitle>
                <CardDescription>Clinical station behavioral patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {osceStats && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center rounded-lg bg-muted/50 p-3">
                      <p className="text-2xl font-bold font-display">{osceStats.count}</p>
                      <p className="text-xs text-muted-foreground">Stations Done</p>
                    </div>
                    <div className="text-center rounded-lg bg-muted/50 p-3">
                      <p className="text-2xl font-bold font-display">{osceStats.avgScore}%</p>
                      <p className="text-xs text-muted-foreground">Avg Score</p>
                    </div>
                    <div className="text-center rounded-lg bg-muted/50 p-3">
                      <p className="text-2xl font-bold font-display">{osceStats.subjects.length}</p>
                      <p className="text-xs text-muted-foreground">Subjects Covered</p>
                    </div>
                  </div>
                )}
                {psychograph && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Psychograph Dimensions</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { label: 'Cognitive Stability', value: psychograph.cognitive_stability },
                        { label: 'Emotional Reactivity', value: psychograph.emotional_reactivity },
                        { label: 'Silence Tolerance', value: psychograph.silence_tolerance },
                        { label: 'Delegation Confidence', value: psychograph.delegation_confidence },
                        { label: 'Structure Integrity', value: psychograph.structure_integrity },
                        { label: 'Time Compression', value: psychograph.time_compression_vulnerability },
                      ].map(dim => (
                        <div key={dim.label} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">{dim.label}</p>
                            <div className="h-1.5 rounded-full bg-muted mt-1">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${dim.value}%` }} />
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold">{dim.value}</span>
                        </div>
                      ))}
                    </div>
                    <Badge variant="outline" className="mt-2">OSCE Archetype: {psychograph.archetype}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button asChild className="gap-1">
            <Link to="/practice">Start Targeted Practice <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/profile">View Performance Profile</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/trust-your-gut">Trust Your Gut Training</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
