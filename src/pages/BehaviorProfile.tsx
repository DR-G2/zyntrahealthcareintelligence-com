import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BehaviorSkeleton } from '@/components/skeletons/PageSkeleton';
import { Brain, Zap, Clock, Shield, ArrowRight, RefreshCw, Activity, Loader2, TrendingDown } from "lucide-react";
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

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from('behavior_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setData(profile as any);
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke('analyze-behavior');
      if (error) throw error;
      const { data: profile } = await supabase
        .from('behavior_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      setData(profile as any);
      toast({ title: 'Analysis complete', description: 'Your behaviour profile has been updated.' });
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message || 'Try again later', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  if (!gate.canAccessBehavior) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#081224]/70 p-8 backdrop-blur-xl">
        <UpgradePrompt feature="Behavior Analysis" description="Behaviour analysis is available on eligible plans." />
      </div>
    );
  }

  if (loading) return <BehaviorSkeleton />;

  if (!data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#081224]/70 p-10 text-center backdrop-blur-xl">
        <Brain className="mx-auto h-10 w-10 text-cyan-300/60" />
        <h2 className="mt-4 font-display text-xl font-semibold text-white">Build your behaviour view</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Complete practice sessions, then run the analysis to turn recorded decision behaviour into a usable view.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild variant="outline"><Link to="/practice">Start Practice</Link></Button>
          <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Run Analysis
          </Button>
        </div>
      </div>
    );
  }

  const signals = data.archetype_signals || {};
  const blocks = Object.entries(data.block_performance || {}).map(([name, value]) => ({
    name,
    accuracy: value.accuracy,
    avgTime: value.avgTime,
    changeRate: value.changeRate,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-purple-300/80">Behaviour</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white">How you approach questions</h2>
          <p className="mt-1 text-sm text-slate-500">Observed timing, changes and session patterns from recorded practice behaviour.</p>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing} variant="outline" className="gap-2 self-start sm:self-auto">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-analyze
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Rush Index', value: signals.rushIndex, icon: Zap, accent: 'text-amber-300 bg-amber-400/10 border-amber-400/15' },
          { label: 'Hesitation Index', value: signals.hesitationIndex, icon: Clock, accent: 'text-purple-300 bg-purple-400/10 border-purple-400/15' },
          { label: 'Fatigue Index', value: signals.fatigueIndex, icon: TrendingDown, accent: 'text-rose-300 bg-rose-400/10 border-rose-400/15' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
              <div className={cn('mb-4 inline-flex rounded-lg border p-2', item.accent)}><Icon className="h-4 w-4" /></div>
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="mt-2 font-display text-3xl font-semibold text-white">{item.value == null ? '—' : Math.round(Number(item.value))}</p>
              <p className="mt-1 text-[11px] text-slate-600">recorded behaviour signal</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-300" />
            <h3 className="font-display text-base font-semibold text-white">Decision timing</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">Average timing, before-first-click timing and changes are kept as observable behaviour signals.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-[11px] text-slate-500">Average time / question</p>
              <p className="mt-2 font-display text-2xl font-semibold text-white">{signals.avgTime ? Math.round(Number(signals.avgTime)) + 's' : '—'}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-[11px] text-slate-500">Answer change rate</p>
              <p className="mt-2 font-display text-2xl font-semibold text-white">{signals.changeRate == null ? '—' : Math.round(Number(signals.changeRate) * 100) + '%'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-300" />
            <h3 className="font-display text-base font-semibold text-white">Behaviour through a session</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">See whether recorded behaviour changes as question position increases.</p>
          {blocks.length ? (
            <div className="mt-5 space-y-3">
              {blocks.slice(0, 6).map(block => (
                <div key={block.name}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{block.name}</span>
                    <span className="text-slate-500">{Math.round(block.accuracy)}% accuracy</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-purple-400" style={{ width: Math.max(0, Math.min(100, block.accuracy)) + '%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] p-6 text-center text-xs text-slate-500">
              More recorded sessions are needed to show session behaviour.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-300" />
          <h3 className="font-display text-base font-semibold text-white">Observed behaviour</h3>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          Zyntra reports interaction signals from practice data. These are behavioural measurements, not personality or clinical judgements.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-white">Rush</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Fast recorded responses that cross the engine's rush threshold.</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-white">Hesitation</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Long response time or delayed first interaction.</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-white">Fatigue</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Later-session incorrect responses used as an endurance signal.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
