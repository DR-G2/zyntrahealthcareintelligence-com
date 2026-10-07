import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BehaviorSkeleton } from '@/components/skeletons/PageSkeleton';
import { Activity,
  Brain, AlertTriangle, Zap, Clock, Shield, Target,
  TrendingUp, TrendingDown, ArrowRight, RefreshCw, Loader2
} from 'lucide-react';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { pieV2AuthHeaders } from '@/lib/pie/pie-history-client';

const ARCHETYPE_META: Record<string, { label: string; icon: typeof Brain; color: string; description: string; risk?: string }> = {
  panic_changer: {
    label: 'Frequent Answer Changes',
    icon: RefreshCw,
    color: 'hsl(var(--destructive))',
    description: 'The recorded attempts show a higher rate of answer changes. This is an observation of response behaviour, not a personality label.',
  },
  rusher: {
    label: 'Fast Response Pattern',
    icon: Zap,
    color: 'hsl(var(--warning))',
    description: 'Recorded response times show a tendency toward faster decisions. Review whether speed is affecting accuracy.',
  },
  paralyzer: {
    label: 'Slow Decision Pattern',
    icon: Clock,
    color: 'hsl(var(--destructive))',
    description: 'Recorded response times show longer decisions. This may matter when working under a fixed exam clock.',
  },
  strategist: {
    label: 'Stable Response Pattern',
    icon: Target,
    color: 'hsl(var(--success))',
    description: 'Recorded attempts show comparatively stable decision behaviour across the available sample.',
  },
  fatigue_victim: {
    label: 'Late-Session Change',
    icon: TrendingDown,
    color: 'hsl(var(--destructive))',
    description: 'Recorded later-session attempts show a change in performance or decision behaviour compared with earlier attempts.',
  },
  subject_avoider: {
    label: 'Subject-Specific Pattern',
    icon: Shield,
    color: 'hsl(var(--warning))',
    description: 'The available data shows a behaviour pattern concentrated in particular subjects.',
  },
};

interface BehaviorData {
  archetype: string;
  archetype_signals: any;
  block_performance: Record<string, { accuracy: number; avgTime: number; changeRate: number }>;
  subject_patterns: Record<string, { accuracy: number; changeRate: number; avgTime: number; total: number; type: string }>;
  trap_flags: Array<{ trap: string; description: string; severity: string }>;
  recommendations: Array<{ title: string; description: string; priority: string; action_link?: string }>;
}

export default function BehaviorProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const gate = useFeatureGate();
  const [data, setData] = useState<BehaviorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from('behavior_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) setData(profile as any);
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke('analyze-behavior', { headers: await pieV2AuthHeaders() }); // P5: PIE attempts on V2
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
        <UpgradePrompt feature="Behavior Analysis" description="Behaviour analysis is an advanced feature that summarizes recorded timing, answer-change and session patterns." />
      </div>
    );
  }

  if (loading) {
    return <BehaviorSkeleton />;
  }

  if (!data) {
    return (
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
    <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex justify-end"><Button onClick={runAnalysis} disabled={analyzing} variant="outline" className="w-full shrink-0 gap-2 sm:w-auto">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-analyze
          </Button></div>

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
                    {meta.risk && (<Badge variant={meta.risk === 'Low' ? 'default' : meta.risk === 'High' ? 'destructive' : 'secondary'}>
                      AMC Risk: {meta.risk}
                    </Badge>)}
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
                <CardTitle>Subject Patterns</CardTitle>
                <CardDescription>Accuracy, timing and change patterns by subject.</CardDescription>
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

        {/* Observed Decision Flags */}
        {(data.trap_flags || []).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Observed Decision Flags
                </CardTitle>
                <CardDescription>Patterns flagged by the existing behaviour analysis.</CardDescription>
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
                <CardDescription>Actions based on your current recorded behaviour signals.</CardDescription>
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

        <div className="flex flex-wrap gap-3">
          <Button asChild className="gap-1">
            <Link to="/practice">Continue Practice <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
  );
}
