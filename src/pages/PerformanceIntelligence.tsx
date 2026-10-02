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
  calibration: number;
  stability: number;
  timeSensitivity: number;
  attempts: number;
  changedAnswers: number;
  confidenceAttempts: number;
  overconfidentErrors: number;
  underconfidentCorrect: number;
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

const reveal = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

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
    readiness: 0, accuracy: 0, calibration: 0, stability: 0, timeSensitivity: 0, attempts: 0, changedAnswers: 0, confidenceAttempts: 0, overconfidentErrors: 0, underconfidentCorrect: 0,
  });
  const [loading, setLoading] = useState(true);
  const [subjectStats, setSubjectStats] = useState<Array<{ subject: string; attempts: number; accuracy: number; recentAccuracy: number; trend: 'up' | 'down' | 'flat' }>>([]);
  const [subtopicStats, setSubtopicStats] = useState<Array<{ subtopic: string; subject: string; attempts: number; accuracy: number; recentAccuracy: number; trend: 'up' | 'down' | 'flat'; misses: number; swaps: number }>>([]);
  const [priorityStats, setPriorityStats] = useState<Array<{ subtopic: string; subject: string; score: number; accuracy: number; attempts: number; reason: string }>>([]);
  const [confidenceBySubject, setConfidenceBySubject] = useState<Array<{ subject: string; calibration: number; attempts: number }>>([]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const [profileRes, dnaRes, attemptsRes] = await Promise.all([
        supabase.from('performance_profiles').select('readiness_score, clinical_accuracy, stability_score, time_sensitivity').eq('user_id', user.id).maybeSingle(),
        supabase.from('readiness_dna').select('confidence_calibration, confidence_attempt_count').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_attempts').select('is_correct, answer_changes_count, confidence_level, created_at, questions(category, subtopic)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(2000),
      ]);
      const attempts = attemptsRes.data || [];

      const bySubject = new Map<string, Array<{ is_correct: boolean; created_at: string }>>();
      const bySubtopic = new Map<string, Array<{ is_correct: boolean; created_at: string; subject: string; answer_changes_count: number }>>();
      attempts.forEach((a: any) => {
        const subject = a.questions?.category || 'Uncategorised';
        const list = bySubject.get(subject) || [];
        list.push({ is_correct: Boolean(a.is_correct), created_at: a.created_at });
        bySubject.set(subject, list);

        const subtopic = a.questions?.subtopic || 'Uncategorised';
        const subtopicKey = `${subject}::${subtopic}`;
        const subtopicList = bySubtopic.get(subtopicKey) || [];
        subtopicList.push({ is_correct: Boolean(a.is_correct), created_at: a.created_at, subject, answer_changes_count: Number(a.answer_changes_count || 0) });
        bySubtopic.set(subtopicKey, subtopicList);
      });

      setSubjectStats(Array.from(bySubject.entries()).map(([subject, rows]) => {
        const ordered = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const split = Math.max(1, Math.floor(ordered.length / 2));
        const earlier = ordered.slice(0, split);
        const recent = ordered.slice(-Math.max(1, Math.min(10, Math.floor(ordered.length / 2))));
        const accuracy = ordered.filter(r => r.is_correct).length / ordered.length * 100;
        const recentAccuracy = recent.filter(r => r.is_correct).length / recent.length * 100;
        const earlierAccuracy = earlier.filter(r => r.is_correct).length / earlier.length * 100;
        const delta = recentAccuracy - earlierAccuracy;
        return {
          subject,
          attempts: ordered.length,
          accuracy: Math.round(accuracy),
          recentAccuracy: Math.round(recentAccuracy),
          trend: delta >= 5 ? 'up' : delta <= -5 ? 'down' : 'flat',
        };
      }).sort((a, b) => a.accuracy - b.accuracy));
      setSubtopicStats(Array.from(bySubtopic.entries())
        .map(([key, rows]) => {
          const ordered = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const accuracy = ordered.filter(r => r.is_correct).length / ordered.length * 100;
          const recent = ordered.slice(-Math.max(1, Math.min(10, Math.floor(ordered.length / 2))));
          const earlier = ordered.slice(0, Math.max(1, Math.floor(ordered.length / 2)));
          const recentAccuracy = recent.filter(r => r.is_correct).length / recent.length * 100;
          const earlierAccuracy = earlier.filter(r => r.is_correct).length / earlier.length * 100;
          const delta = recentAccuracy - earlierAccuracy;
          const [subject, subtopic] = key.split('::');
          return {
            subtopic,
            subject,
            attempts: ordered.length,
            accuracy: Math.round(accuracy),
            recentAccuracy: Math.round(recentAccuracy),
            trend: delta >= 5 ? 'up' : delta <= -5 ? 'down' : 'flat',
            misses: ordered.filter(r => !r.is_correct).length,
            swaps: ordered.filter(r => r.answer_changes_count > 0).length,
          };
        })
        .filter(row => row.attempts >= 3)
        .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
        .slice(0, 12));

      const priorityRows = Array.from(bySubtopic.entries()).map(([key, rows]) => {
        const ordered = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const attemptsCount = ordered.length;
        if (attemptsCount < 3) return null;
        const accuracy = ordered.filter(r => r.is_correct).length / attemptsCount * 100;
        const recent = ordered.slice(-Math.max(1, Math.min(10, Math.floor(attemptsCount / 2))));
        const recentAccuracy = recent.filter(r => r.is_correct).length / recent.length * 100;
        const misses = ordered.filter(r => !r.is_correct).length;
        const swaps = ordered.filter(r => r.answer_changes_count > 0).length;
        const [subject, subtopic] = key.split('::');
        const weakness = Math.max(0, 100 - accuracy);
        const recencyPenalty = Math.max(0, 60 - recentAccuracy);
        const repeatMissSignal = Math.min(25, (misses / attemptsCount) * 25);
        const instabilitySignal = Math.min(15, (swaps / attemptsCount) * 15);
        const score = Math.round(weakness * 0.5 + recencyPenalty * 0.25 + repeatMissSignal + instabilitySignal);
        const reason = accuracy < 50 ? 'Low accuracy' : recentAccuracy < accuracy - 10 ? 'Recent decline' : swaps / attemptsCount >= 0.35 ? 'Answer instability' : 'Needs reinforcement';
        return { subtopic, subject, score, accuracy: Math.round(accuracy), attempts: attemptsCount, reason };
      }).filter(Boolean) as Array<{ subtopic: string; subject: string; score: number; accuracy: number; attempts: number; reason: string }>;
      setPriorityStats(priorityRows.sort((a, b) => b.score - a.score).slice(0, 5));

      const confidenceMap = new Map<string, { total: number; score: number }>();
      attempts.forEach((a: any) => {
        const confidence = Number(a.confidence_level);
        if (confidence < 1 || confidence > 5) return;
        const subject = a.questions?.category || 'Uncategorised';
        const entry = confidenceMap.get(subject) || { total: 0, score: 0 };
        const confidencePct = (confidence - 1) * 25;
        const calibration = Math.max(0, 100 - Math.abs(confidencePct - (a.is_correct ? 100 : 0)));
        entry.total += 1;
        entry.score += calibration;
        confidenceMap.set(subject, entry);
      });
      setConfidenceBySubject(Array.from(confidenceMap.entries())
        .map(([subject, value]) => ({ subject, attempts: value.total, calibration: Math.round(value.score / value.total) }))
        .sort((a, b) => a.calibration - b.calibration)
        .slice(0, 6));
      setSnapshot({
        readiness: Number(profileRes.data?.readiness_score || 0),
        calibration: Number(dnaRes.data?.confidence_calibration || 0),
        accuracy: Number(profileRes.data?.clinical_accuracy || 0),
        stability: Number(profileRes.data?.stability_score || 0),
        timeSensitivity: Number(profileRes.data?.time_sensitivity || 0),
        attempts: attempts.length,
        changedAnswers: attempts.filter(a => (a.answer_changes_count || 0) > 0).length,
        confidenceAttempts: attempts.filter(a => Number(a.confidence_level) >= 1 && Number(a.confidence_level) <= 5).length,
        overconfidentErrors: attempts.filter(a => Number(a.confidence_level) >= 4 && !a.is_correct).length,
        underconfidentCorrect: attempts.filter(a => Number(a.confidence_level) <= 2 && a.is_correct).length,
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
      { id: 'calibration', label: 'Confidence Calibration', value: snapshot.calibration, displayValue: snapshot.confidenceAttempts ? `${Math.round(snapshot.calibration)}%` : 'Awaiting data', helper: `How closely confidence matches the outcome across recorded attempts. Confidence sample: ${snapshot.confidenceAttempts} attempts.`, accent: 'emerald', points: [42, 46, 44, 53, 50, 58, Math.max(snapshot.calibration, 8)] },
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
      <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-6xl space-y-6">
        <motion.div variants={reveal}><RoomHeader kind="intelligence" /></motion.div>

        <motion.div variants={reveal} className="grid grid-cols-3 rounded-2xl border border-white/10 bg-white/[0.025] p-1.5">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleTab(tab.id)} className={cn('relative flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all', activeTab === tab.id ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {activeTab === tab.id && <span className="absolute bottom-0 h-px w-12 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.8)]" />}
            </button>
          ))}
        </motion.div>

        <motion.section variants={reveal} className="rounded-3xl border border-cyan-400/10 bg-gradient-to-br from-cyan-400/[0.045] via-[#081224]/80 to-[#081224]/70 p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-300/80">Your intelligence layer</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-white">Performance at a glance</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Zyntra combines accuracy, decision behaviour, timing and confidence into one evolving picture of how you perform under exam conditions.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link to="/practice" className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-400/15">Practice <ArrowRight className="h-3.5 w-3.5" /></Link>
              <Link to="/plan" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.07]">Study Plan <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </motion.section>

        <motion.section variants={reveal} className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
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
        </motion.section>

        <motion.section variants={reveal} className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-display font-semibold text-white">Intelligence Signals</p>
                <p className="mt-1 text-[11px] text-slate-500">The four behavioural dimensions currently feeding your readiness model.</p>
              </div>
              <Brain className="h-4 w-4 text-cyan-300/70" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map(metric => (
                <div key={metric.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">{metric.label}</span>
                    <span className="font-display text-sm font-semibold text-white">{metric.displayValue}</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: metric.value == null ? '0%' : String(Math.min(100, Math.max(0, metric.value))) + '%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-display font-semibold text-white">What the data says</p>
                <p className="mt-1 text-[11px] text-slate-500">A compact read of the strongest signals in your current sample.</p>
              </div>
              <Sparkles className="h-4 w-4 text-cyan-300/70" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5"><span className="text-xs text-slate-400">Answer changes</span><span className="text-sm font-semibold text-white">{snapshot.attempts ? String(Math.round((snapshot.changedAnswers / snapshot.attempts) * 100)) + '%' : 'Awaiting data'}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5"><span className="text-xs text-slate-400">Confidence-rated attempts</span><span className="text-sm font-semibold text-white">{snapshot.confidenceAttempts || 'Awaiting data'}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5"><span className="text-xs text-slate-400">Confident errors</span><span className="text-sm font-semibold text-rose-300">{snapshot.overconfidentErrors}</span></div>
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5"><span className="text-xs text-slate-400">Under-confident correct</span><span className="text-sm font-semibold text-emerald-300">{snapshot.underconfidentCorrect}</span></div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={reveal}>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-lg font-display font-semibold text-white">Next Best Study Priorities</p>
              <p className="mt-1 text-xs text-slate-500">Combines weakness, recent performance, repeated misses and answer instability into a focused queue.</p>
            </div>
            <Target className="h-4 w-4 text-cyan-300/70" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {loading ? [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
            )) : priorityStats.length ? priorityStats.map((row, index) => (
              <div key={`${row.subject}::${row.subtopic}`} className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.025] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300/70">Priority {index + 1}</span>
                  <span className="text-xs font-semibold text-white">{row.score}</span>
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-white">{row.subtopic}</p>
                <p className="mt-1 truncate text-[11px] text-slate-500">{row.subject}</p>
                <div className="mt-4 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">{row.attempts} attempts</span>
                  <span className="font-medium text-rose-300">{row.accuracy}% accuracy</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-600">{row.reason}</p>
                <Link
                  to={`/practice?focus=${encodeURIComponent(row.subtopic)}&subject=${encodeURIComponent(row.subject)}`}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
                >
                  Practice this <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )) : (
              <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
                Complete at least 3 attempts in a subtopic to generate study priorities.
              </div>
            )}
          </div>
        </motion.section>

        <motion.section variants={reveal}>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-lg font-display font-semibold text-white">Confidence by Subject</p>
              <p className="mt-1 text-xs text-slate-500">Where confidence and outcomes are most misaligned, based only on attempts with recorded confidence.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {confidenceBySubject.length ? confidenceBySubject.map(row => (
              <div key={row.subject} className="rounded-2xl border border-white/10 bg-[#081224]/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{row.subject}</p>
                  <span className="text-sm font-semibold text-emerald-300">{row.calibration}%</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{row.attempts} confidence-rated attempts</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: row.calibration + '%' }} />
                </div>
              </div>
            )) : (
              <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
                Confidence-rated attempts will build this map.
              </div>
            )}
          </div>
        </motion.section>
        <motion.section variants={reveal}>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-lg font-display font-semibold text-white">Subject Trajectory</p>
              <p className="mt-1 text-xs text-slate-500">Accuracy and direction from your recorded MCQ attempts.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {loading ? [1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
            )) : subjectStats.length ? subjectStats.map(row => (
              <div key={row.subject} className="rounded-2xl border border-white/10 bg-[#081224]/70 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{row.subject}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.attempts} attempts · recent {row.recentAccuracy}%</p>
                  </div>
                  <span className={cn('text-xs font-medium', row.trend === 'up' ? 'text-emerald-300' : row.trend === 'down' ? 'text-rose-300' : 'text-slate-400')}>
                    {row.trend === 'up' ? 'Improving' : row.trend === 'down' ? 'Declining' : 'Stable'}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${row.accuracy}%` }} />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold text-white">{row.accuracy}%</span>
                </div>
              </div>
            )) : (
              <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
                Complete MCQs to build subject trajectories.
              </div>
            )}
          </div>
        </motion.section>

        <motion.section variants={reveal}>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-lg font-display font-semibold text-white">Subtopic Weakness Map</p>
              <p className="mt-1 text-xs text-slate-500">Repeated subtopics with enough attempts to form a useful signal, ranked by current accuracy.</p>
            </div>
            <Sparkles className="h-4 w-4 text-cyan-300/70" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {loading ? [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
            )) : subtopicStats.length ? subtopicStats.map(row => (
              <div key={`${row.subject}::${row.subtopic}`} className="rounded-2xl border border-white/10 bg-[#081224]/70 p-4 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{row.subtopic}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{row.subject} · {row.attempts} attempts</p>
                  </div>
                  <span className={cn('shrink-0 text-xs font-medium', row.trend === 'up' ? 'text-emerald-300' : row.trend === 'down' ? 'text-rose-300' : 'text-slate-400')}>
                    {row.trend === 'up' ? 'Improving' : row.trend === 'down' ? 'Declining' : 'Stable'}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${row.accuracy}%` }} />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold text-white">{row.accuracy}%</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-600">Recent: {row.recentAccuracy}%</p>
              </div>
            )) : (
              <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
                Complete at least 3 attempts in a subtopic to build a reliable weakness signal.
              </div>
            )}
          </div>
        </motion.section>

        <motion.section variants={reveal}>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-lg font-display font-semibold text-white">Connected Training Rooms</p>
              <p className="mt-1 text-xs text-slate-500">Keep training, planning and intelligence connected without leaving this layer.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <QuickLink to="/practice" title="Practice" description="Generate the question telemetry that feeds intelligence." icon={Brain} />
            <QuickLink to="/practice/osce" title="OSCE" description="Add structured clinical-station signals." icon={ClipboardCheck} />
            <QuickLink to="/plan" title="Study Plan" description="Turn current signals into the next training priorities." icon={Activity} />
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
        </motion.section>

        <motion.div variants={reveal}><AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-12 text-center text-sm text-slate-500">Loading intelligence layer...</div>}>
              {activeTab === 'performance' && <ProfileContent />}
              {activeTab === 'behavior' && <BehaviorContent />}
              {activeTab === 'trust-your-gut' && <TrustYourGutContent />}
            </Suspense>
          </motion.div>
        </AnimatePresence></motion.div>
      </motion.div>
    </AppLayout>
  );
}
