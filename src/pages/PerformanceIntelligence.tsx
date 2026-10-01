import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, ClipboardCheck, Activity, ArrowRight, Gauge, RefreshCw, Sparkles, Target, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { RoomHeader } from '@/components/RoomHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const ProfileContent = lazy(() => import('./Profile'));
const BehaviorContent = lazy(() => import('./BehaviorProfile'));
const TrustYourGutContent = lazy(() => import('./TrustYourGut'));

type TabId = 'performance' | 'behavior' | 'trust-your-gut';

interface TelemetryMetric {
  id: string;
  label: string;
  value: number | null;
  displayValue: string;
  helper: string;
  accent: 'cyan' | 'purple' | 'rose' | 'emerald';
  points: number[];
}

interface PerformanceSnapshot {
  readiness: number;
  accuracy: number;
  stability: number;
  timeSensitivity: number;
  attempts: number;
  changedAnswers: number;
}

const TABS: Array<{ id: TabId; label: string; icon: typeof UserCircle }> = [
  { id: 'performance', label: 'Performance', icon: UserCircle },
  { id: 'behavior', label: 'Behaviour', icon: Brain },
  { id: 'trust-your-gut', label: 'Trust Your Gut', icon: Target },
];

const accentClasses = {
  cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
  purple: 'text-purple-300 bg-purple-400/10 border-purple-400/20',
  rose: 'text-rose-300 bg-rose-400/10 border-rose-400/20',
  emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
};

function Sparkline({ points, accent }: { points: number[]; accent: TelemetryMetric['accent'] }) {
  const stroke = { cyan: '#22d3ee', purple: '#c084fc', rose: '#fb7185', emerald: '#34d399' }[accent];
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const coords = points.map((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * 100;
    const y = 34 - ((p - min) / range) * 28;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="h-10 w-28">
      <polyline points={coords} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MetricCard({ metric }: { metric: TelemetryMetric }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-[#0a1629]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={cn('mb-3 inline-flex rounded-lg border p-2', accentClasses[metric.accent])}>
            <Activity className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-slate-200">{metric.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{metric.helper}</p>
        </div>
        <Sparkline points={metric.points} accent={metric.accent} />
      </div>
      <div className="mt-5 flex items-end justify-between">
        <span className="font-display text-2xl font-semibold text-white">{metric.displayValue}</span>
        {metric.value !== null && <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">signal</span>}
      </div>
    </div>
  );
}

function QuickLink({ to, title, description, icon: Icon }: { to: string; title: string; description: string; icon: typeof Brain }) {
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-all hover:border-cyan-400/30 hover:bg-cyan-400/[0.035]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/10 text-cyan-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-cyan-300" />
    </Link>
  );
}

export default function PerformanceIntelligence() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(TABS.some(t => t.id === requested) ? requested! : 'performance');
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot>({
    readiness: 0, accuracy: 0, stability: 0, timeSensitivity: 0, attempts: 0, changedAnswers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const [profileRes, attemptsRes] = await Promise.all([
        supabase.from('performance_profiles').select('readiness_score, clinical_accuracy, stability_score, time_sensitivity').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_attempts').select('is_correct, answer_changes_count').eq('user_id', user.id).limit(1000),
      ]);
      const attempts = attemptsRes.data || [];
      setSnapshot({
        readiness: Number(profileRes.data?.readiness_score || 0),
        accuracy: Number(profileRes.data?.clinical_accuracy || 0),
        stability: Number(profileRes.data?.stability_score || 0),
        timeSensitivity: Number(profileRes.data?.time_sensitivity || 0),
        attempts: attempts.length,
        changedAnswers: attempts.filter(a => (a.answer_changes_count || 0) > 0).length,
      });
      setLoading(false);
    };
    load();
  }, [user]);

  const metrics = useMemo<TelemetryMetric[]>(() => {
    const changeRate = snapshot.attempts ? Math.round((snapshot.changedAnswers / snapshot.attempts) * 100) : 0;
    return [
      { id: 'timing', label: 'Deliberation Timing', value: snapshot.timeSensitivity, displayValue: loading ? '...' : snapshot.attempts ? `${Math.round(snapshot.timeSensitivity)}%` : 'Awaiting data', helper: 'Time-management signal from recorded attempts.', accent: 'cyan', points: [42, 48, 45, 58, 54, 63, Math.max(snapshot.timeSensitivity, 8)] },
      { id: 'swaps', label: 'Option Swaps', value: changeRate, displayValue: snapshot.attempts ? `${changeRate}%` : 'Awaiting data', helper: 'Share of recorded attempts where an answer changed.', accent: 'rose', points: [20, 28, 24, 32, 26, 35, Math.max(changeRate, 6)] },
      { id: 'stability', label: 'Answer Stability', value: snapshot.stability, displayValue: snapshot.attempts ? `${Math.round(snapshot.stability)}%` : 'Awaiting data', helper: 'Consistency signal calculated by the intelligence engine.', accent: 'purple', points: [55, 52, 61, 58, 66, 64, Math.max(snapshot.stability, 8)] },
      { id: 'calibration', label: 'Confidence Calibration', value: null, displayValue: 'Not tracked yet', helper: 'Confidence telemetry will appear when confidence data is available.', accent: 'emerald', points: [14, 14, 18, 16, 20, 18, 22] },
    ];
  }, [snapshot, loading]);

  const handleTab = (tab: TabId) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const readiness = Math.max(0, Math.min(100, snapshot.readiness));
  const gaugeStyle = { background: `conic-gradient(#22d3ee ${readiness * 3.6}deg, rgba(255,255,255,.06) 0deg)` };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <RoomHeader kind="intelligence" />

        <div className="grid grid-cols-3 rounded-2xl border border-white/10 bg-white/[0.025] p-1.5">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleTab(tab.id)} className={cn('relative flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all', activeTab === tab.id ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {activeTab === tab.id && <span className="absolute bottom-0 h-px w-12 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.8)]" />}
            </button>
          ))}
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-300/80">Connected rooms</p>
              <p className="mt-1 text-xs text-slate-500">Move between training surfaces without leaving the intelligence layer.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <QuickLink to="/practice" title="Practice" description="Generate the question telemetry that feeds intelligence." icon={Brain} />
            <QuickLink to="/practice/osce" title="OSCE" description="Add structured clinical-station signals." icon={ClipboardCheck} />
            <QuickLink to="/plan" title="Study Plan" description="Turn current signals into the next training priorities." icon={Activity} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_2fr]">
          <div className="rounded-3xl border border-white/10 bg-[#081224]/70 p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Gauge className="h-4 w-4 text-cyan-300" /> Overall Readiness
            </div>
            <div className="mt-6 flex items-center gap-6">
              <div className="relative h-32 w-32 shrink-0 rounded-full p-2" style={gaugeStyle}>
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#081224]">
                  <div className="text-center">
                    <div className="font-display text-3xl font-bold text-white">{loading ? '...' : Math.round(readiness)}</div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">/ 100</div>
                  </div>
                </div>
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-white">{readiness >= 80 ? 'Calibrated' : readiness >= 50 ? 'Developing' : 'Baseline'}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{snapshot.attempts ? `${snapshot.attempts} recorded attempts contributing to the current signal.` : 'Complete practice to build the first intelligence signal.'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
              <p className="text-xs text-slate-500">Clinical Accuracy</p>
              <p className="mt-3 font-display text-3xl font-semibold text-white">{snapshot.attempts ? `${Math.round(snapshot.accuracy)}%` : '—'}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, snapshot.accuracy)}%` }} /></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
              <p className="text-xs text-slate-500">Recorded Attempts</p>
              <p className="mt-3 font-display text-3xl font-semibold text-white">{snapshot.attempts}</p>
              <p className="mt-2 text-[11px] font-mono text-slate-600">telemetry sample</p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-lg font-display font-semibold text-white">Cognitive &amp; Behavioural Telemetry</p>
              <p className="mt-1 text-xs text-slate-500">Signals are derived from recorded decision behaviour, not guessed from profile text.</p>
            </div>
            <RefreshCw className="h-4 w-4 text-slate-600" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {metrics.map(metric => <MetricCard key={metric.id} metric={metric} />)}
          </div>
        </section>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-12 text-center text-sm text-slate-500">Loading intelligence layer...</div>}>
              {activeTab === 'performance' && <ProfileContent />}
              {activeTab === 'behavior' && <BehaviorContent />}
              {activeTab === 'trust-your-gut' && <TrustYourGutContent />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
