import { lazy, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Brain,
  Gauge,
  Target,
  TrendingDown,
  TrendingUp,
  UserCircle,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { RoomHeader } from '@/components/RoomHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type TabId = 'performance' | 'behavior' | 'trust-your-gut';

const TABS: Array<{ id: TabId; label: string; icon: typeof UserCircle; description: string }> = [
  {
    id: 'performance',
    label: 'Performance',
    icon: Activity,
    description: 'How you are performing',
  },
  {
    id: 'behavior',
    label: 'Behaviour',
    icon: Brain,
    description: 'How you approach decisions',
  },
  {
    id: 'trust-your-gut',
    label: 'Trust Your Gut',
    icon: Target,
    description: 'What happens when you change an answer',
  },
];

interface Attempt {
  is_correct: boolean;
  answer_changes_count: number;
  confidence_level: number | null;
  created_at: string;
  questions?: {
    category?: string | null;
    subtopic?: string | null;
  } | null;
}

interface SubjectStat {
  subject: string;
  attempts: number;
  accuracy: number;
  recentAccuracy: number;
  trend: 'up' | 'down' | 'flat';
}

interface PriorityStat {
  subtopic: string;
  subject: string;
  score: number;
  accuracy: number;
  attempts: number;
  reason: string;
}

interface Snapshot {
  readiness: number;
  accuracy: number;
  stability: number;
  timing: number;
  calibration: number;
  attempts: number;
  confidenceAttempts: number;
  changedAnswers: number;
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-300 transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function SignalCard({
  label,
  value,
  helper,
  accent = 'cyan',
}: {
  label: string;
  value: string;
  helper: string;
  accent?: 'cyan' | 'purple' | 'rose' | 'emerald';
}) {
  const accents = {
    cyan: 'border-cyan-400/15 bg-cyan-400/[0.045] text-cyan-300',
    purple: 'border-purple-400/15 bg-purple-400/[0.045] text-purple-300',
    rose: 'border-rose-400/15 bg-rose-400/[0.045] text-rose-300',
    emerald: 'border-emerald-400/15 bg-emerald-400/[0.045] text-emerald-300',
  };

  return (
    <div className={cn('rounded-2xl border p-4', accents[accent])}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function PerformanceView({
  snapshot,
  subjects,
  priorities,
  trend,
  loading,
}: {
  snapshot: Snapshot;
  subjects: SubjectStat[];
  priorities: PriorityStat[];
  trend: number[];
  loading: boolean;
}) {
  const readiness = Math.max(0, Math.min(100, snapshot.readiness));
  const readinessLabel = readiness >= 80 ? 'Calibrated' : readiness >= 50 ? 'Developing' : 'Baseline';

  return (
    <motion.div
      key="performance"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <section className="grid gap-5 lg:grid-cols-[1.05fr_1.95fr]">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.07] via-[#081224]/90 to-[#081224]/75 p-6">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Gauge className="h-4 w-4 text-cyan-300" />
              Overall Readiness
            </div>
            <div className="mt-6 flex items-center gap-5">
              <div
                className="relative h-32 w-32 shrink-0 rounded-full p-2"
                style={{ background: `conic-gradient(#22d3ee ${readiness * 3.6}deg, rgba(255,255,255,.06) 0deg)` }}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#081224]">
                  <div className="text-center">
                    <div className="font-display text-3xl font-bold text-white">{loading ? '...' : Math.round(readiness)}</div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">/ 100</div>
                  </div>
                </div>
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-white">{readinessLabel}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {snapshot.attempts
                    ? `${snapshot.attempts} recorded attempts contribute to this signal.`
                    : 'Complete practice to build your first performance signal.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SignalCard label="Accuracy" value={snapshot.attempts ? `${Math.round(snapshot.accuracy)}%` : '—'} helper="Clinical correctness across recorded attempts." />
          <SignalCard label="Stability" value={snapshot.attempts ? `${Math.round(snapshot.stability)}%` : '—'} helper="Consistency based on recorded answer changes." accent="purple" />
          <SignalCard label="Timing" value={snapshot.attempts ? `${Math.round(snapshot.timing)}%` : '—'} helper="Time-management signal from attempts." accent="rose" />
          <SignalCard label="Calibration" value={snapshot.confidenceAttempts ? `${Math.round(snapshot.calibration)}%` : '—'} helper={snapshot.confidenceAttempts ? `${snapshot.confidenceAttempts} confidence records.` : 'No confidence data yet.'} accent="emerald" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-[#081224]/75 p-5 backdrop-blur-xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-display text-lg font-semibold text-white">Performance by Subject</p>
              <p className="mt-1 text-xs text-slate-500">Accuracy from your recorded MCQ attempts.</p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">{subjects.length} subjects</span>
          </div>

          <div className="mt-5 space-y-4">
            {subjects.length ? subjects.slice(0, 8).map((subject) => (
              <div key={subject.subject}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-slate-300">{subject.subject}</span>
                  <span className="shrink-0 font-mono text-slate-400">{subject.accuracy}%</span>
                </div>
                <ProgressBar value={subject.accuracy} />
                <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-600">
                  {subject.trend === 'up' ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : subject.trend === 'down' ? <TrendingDown className="h-3 w-3 text-rose-400" /> : null}
                  {subject.attempts} attempts · recent {subject.recentAccuracy}%
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-slate-500">
                No subject-level performance yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#081224]/75 p-5 backdrop-blur-xl">
          <p className="font-display text-lg font-semibold text-white">Recent Performance</p>
          <p className="mt-1 text-xs text-slate-500">Accuracy across recent blocks of recorded attempts.</p>

          {trend.length ? (
            <div className="mt-8 flex h-40 items-end gap-2">
              {trend.map((value, index) => (
                <div key={`trend-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500">{value}%</span>
                  <div className="flex h-28 w-full items-end rounded-lg bg-white/[0.025]">
                    <div className="w-full rounded-lg bg-gradient-to-t from-cyan-500/30 to-cyan-300/70" style={{ height: `${Math.max(4, value)}%` }} />
                  </div>
                  <span className="text-[9px] text-slate-600">{index + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-slate-500">
              Complete more practice to build a trend.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#081224]/75 p-5 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-white">Priority Areas</p>
            <p className="mt-1 text-xs text-slate-500">Areas the existing intelligence rules identify for reinforcement.</p>
          </div>
          <Link to="/practice" className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200">
            Practice <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {priorities.length ? priorities.map((item, index) => (
            <div key={`${item.subject}-${item.subtopic}`} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-xs font-semibold text-cyan-300">{index + 1}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{item.subtopic}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">{item.subject} · {item.attempts} attempts</p>
                  <p className="mt-2 text-xs text-slate-400">{item.reason} · {item.accuracy}% accuracy</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="md:col-span-2 rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
              Priority areas will appear after enough attempts are recorded.
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/practice" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
          Continue Practice <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/plan" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07]">
          Open Study Plan <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}

const BehaviorContent = lazy(() => import('./BehaviorProfile'));
const TrustYourGutContent = lazy(() => import('./TrustYourGut'));

export default function PerformanceIntelligence() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(TABS.some(tab => tab.id === requested) ? requested! : 'performance');
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    readiness: 0,
    accuracy: 0,
    stability: 0,
    timing: 0,
    calibration: 0,
    attempts: 0,
    confidenceAttempts: 0,
    changedAnswers: 0,
  });
  const [subjects, setSubjects] = useState<SubjectStat[]>([]);
  const [priorities, setPriorities] = useState<PriorityStat[]>([]);
  const [trend, setTrend] = useState<number[]>([]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [profileRes, dnaRes, attemptsRes] = await Promise.all([
        supabase
          .from('performance_profiles')
          .select('readiness_score, clinical_accuracy, stability_score, time_sensitivity')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('readiness_dna')
          .select('confidence_calibration, confidence_attempt_count')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_attempts')
          .select('is_correct, answer_changes_count, confidence_level, created_at, questions(category, subtopic)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

      if (cancelled) return;

      const attempts = (attemptsRes.data || []) as unknown as Attempt[];

      const bySubject = new Map<string, Attempt[]>();
      const bySubtopic = new Map<string, Attempt[]>();

      for (const attempt of attempts) {
        const subject = attempt.questions?.category || 'Uncategorised';
        const subtopic = attempt.questions?.subtopic || 'Uncategorised';
        const subjectRows = bySubject.get(subject) || [];
        subjectRows.push(attempt);
        bySubject.set(subject, subjectRows);

        const key = `${subject}::${subtopic}`;
        const subtopicRows = bySubtopic.get(key) || [];
        subtopicRows.push(attempt);
        bySubtopic.set(key, subtopicRows);
      }

      const subjectRows: SubjectStat[] = Array.from(bySubject.entries())
        .map(([subject, rows]) => {
          const ordered = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const midpoint = Math.max(1, Math.floor(ordered.length / 2));
          const earlier = ordered.slice(0, midpoint);
          const recent = ordered.slice(-Math.max(1, Math.min(10, Math.floor(ordered.length / 2))));
          const accuracy = ordered.filter(row => row.is_correct).length / ordered.length * 100;
          const recentAccuracy = recent.filter(row => row.is_correct).length / recent.length * 100;
          const earlierAccuracy = earlier.filter(row => row.is_correct).length / earlier.length * 100;
          const delta = recentAccuracy - earlierAccuracy;

          return {
            subject,
            attempts: ordered.length,
            accuracy: Math.round(accuracy),
            recentAccuracy: Math.round(recentAccuracy),
            trend: (delta >= 5 ? 'up' : delta <= -5 ? 'down' : 'flat') as 'up' | 'down' | 'flat',
          };
        })
        .sort((a, b) => a.accuracy - b.accuracy);

      const priorityRows: PriorityStat[] = Array.from(bySubtopic.entries())
        .map(([key, rows]) => {
          if (rows.length < 3) return null;

          const ordered = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const accuracy = ordered.filter(row => row.is_correct).length / ordered.length * 100;
          const recent = ordered.slice(-Math.max(1, Math.min(10, Math.floor(ordered.length / 2))));
          const recentAccuracy = recent.filter(row => row.is_correct).length / recent.length * 100;
          const misses = ordered.filter(row => !row.is_correct).length;
          const swaps = ordered.filter(row => Number(row.answer_changes_count || 0) > 0).length;
          const [subject, subtopic] = key.split('::');
          const weakness = Math.max(0, 100 - accuracy);
          const recencyPenalty = Math.max(0, 60 - recentAccuracy);
          const repeatMissSignal = Math.min(25, (misses / ordered.length) * 25);
          const instabilitySignal = Math.min(15, (swaps / ordered.length) * 15);
          const score = Math.round(weakness * 0.5 + recencyPenalty * 0.25 + repeatMissSignal + instabilitySignal);
          const reason = accuracy < 50
            ? 'Low accuracy'
            : recentAccuracy < accuracy - 10
              ? 'Recent decline'
              : swaps / ordered.length >= 0.35
                ? 'Answer instability'
                : 'Needs reinforcement';

          return {
            subtopic,
            subject,
            score,
            accuracy: Math.round(accuracy),
            attempts: ordered.length,
            reason,
          };
        })
        .filter(Boolean) as PriorityStat[];

      const orderedAttempts = [...attempts].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const trendValues: number[] = [];
      const blockSize = 10;
      const trendStart = Math.max(0, orderedAttempts.length - blockSize * 8);
      for (let i = trendStart; i < orderedAttempts.length && trendValues.length < 8; i += blockSize) {
        const block = orderedAttempts.slice(i, i + blockSize);
        if (block.length >= Math.min(blockSize, 3)) {
          trendValues.push(Math.round(block.filter(row => row.is_correct).length / block.length * 100));
        }
      }

      setSubjects(subjectRows);
      setPriorities(priorityRows.sort((a, b) => b.score - a.score).slice(0, 6));
      setTrend(trendValues);

      setSnapshot({
        readiness: Number(profileRes.data?.readiness_score || 0),
        accuracy: Number(profileRes.data?.clinical_accuracy || 0),
        stability: Number(profileRes.data?.stability_score || 0),
        timing: Number(profileRes.data?.time_sensitivity || 0),
        calibration: Number((dnaRes.data as any)?.confidence_calibration || 0),
        attempts: attempts.length,
        confidenceAttempts: attempts.filter(row => Number(row.confidence_level) >= 1 && Number(row.confidence_level) <= 5).length,
        changedAnswers: attempts.filter(row => Number(row.answer_changes_count || 0) > 0).length,
      });

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const tabDescription = useMemo(
    () => TABS.find(tab => tab.id === activeTab)?.description || '',
    [activeTab],
  );

  const handleTab = (tab: TabId) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <RoomHeader kind="intelligence" />

        <section className="sticky top-2 z-20 rounded-2xl border border-white/10 bg-[#050b14]/90 p-1.5 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTab(tab.id)}
                  aria-selected={active}
                  className={cn(
                    'relative flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition-all sm:text-sm',
                    active
                      ? 'bg-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,.18)]'
                      : 'text-slate-500 hover:bg-white/[0.035] hover:text-slate-300',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active && 'text-cyan-300')} />
                  <span>{tab.label}</span>
                  {active && <span className="absolute inset-x-8 -bottom-1 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />}
                </button>
              );
            })}
          </div>
          <p className="px-2 pb-1 pt-2 text-center text-[11px] text-slate-600">{tabDescription}</p>
        </section>

        <AnimatePresence mode="wait">
          {activeTab === 'performance' && (
            <PerformanceView
              snapshot={snapshot}
              subjects={subjects}
              priorities={priorities}
              trend={trend}
              loading={loading}
            />
          )}
          {activeTab === 'behavior' && (
            <motion.div key="behavior" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <BehaviorContent />
            </motion.div>
          )}
          {activeTab === 'trust-your-gut' && (
            <motion.div key="trust-your-gut" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <TrustYourGutContent />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

