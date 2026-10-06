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

interface ConfidenceSubject {
  subject: string;
  attempts: number;
  accuracy: number;
  average_confidence: number;
  calibration: number;
  bias: number;
  high_confidence_wrong: number;
  low_confidence_correct: number;
}

interface PieState {
  state_timestamp: string | null;
  state_sequence: number;
  capability: number;
  decision: number;
  timing: number;
  calibration: number;
  sustained_performance: number;
  learning: number;
  identification_status: string;
  evidence_level: string;
  data_quality: number;
  observation_count: number;
  model_version: string;
}

interface ConfidenceIntelligence {
  confidence_attempts: number;
  calibration: number;
  average_confidence: number;
  accuracy: number;
  bias: number;
  overconfidence: number;
  underconfidence: number;
  high_confidence_wrong: number;
  low_confidence_correct: number;
  recent_calibration: number;
  prior_calibration: number;
  calibration_delta: number;
  levels: Array<{ level: number; label: string; attempts: number; accuracy: number; calibration: number }>;
  subjects: ConfidenceSubject[];
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
  confidence,
  pie,
  loading,
}: {
  snapshot: Snapshot;
  subjects: SubjectStat[];
  priorities: PriorityStat[];
  trend: number[];
  confidence: ConfidenceIntelligence;
  pie: PieState | null;
  loading: boolean;
}) {
  const readiness = pie ? Math.max(0, Math.min(100, pie.capability * 100)) : Math.max(0, Math.min(100, snapshot.readiness));
  const readinessLabel = pie ? (pie.evidence_level === 'INSUFFICIENT' ? 'Building evidence' : readiness >= 80 ? 'Strong state' : readiness >= 60 ? 'Developing' : 'Early state') : (readiness >= 80 ? 'Calibrated' : readiness >= 50 ? 'Developing' : 'Baseline');

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
              PIE Capability State
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
          <SignalCard label="Avg Time" value={snapshot.attempts ? `${Math.round(snapshot.timing)}s` : '—'} helper="Average response time across recorded attempts." accent="rose" />
          <SignalCard label="Calibration" value={snapshot.confidenceAttempts ? `${Math.round(snapshot.calibration)}%` : '—'} helper={snapshot.confidenceAttempts ? `${snapshot.confidenceAttempts} confidence records.` : 'No confidence data yet.'} accent="emerald" />
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-400/15 bg-[#081224]/75 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-white">PIE Performance Intelligence</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              PIE is the production intelligence engine for this page.
              This state is produced by PIE from your persisted practice behaviour and explicit evidence.
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">
              {pie ? pie.identification_status.replace(/_/g, ' ') : 'AWAITING SIGNAL'}
            </p>
            <p className="mt-1 text-[10px] text-slate-600">
              {pie ? `Evidence: ${pie.evidence_level.replace(/_/g, ' ')}` : 'Complete practice to initialise the PIE engine'}
            </p>
          </div>
        </div>

        {pie ? (
          <>
            <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Capability', pie.capability],
                ['Decision', pie.decision],
                ['Timing', pie.timing],
                ['Calibration', pie.calibration],
                ['Sustained', pie.sustained_performance],
                ['Learning', pie.learning],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <p className="mt-2 font-display text-xl font-semibold text-white">{Math.round(Number(value) * 100)}%</p>
                  <ProgressBar value={Number(value) * 100} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-slate-600">
              <span>{pie.observation_count} observations in latest inference</span>
              <span>Data quality {Math.round(pie.data_quality * 100)}%</span>
              <span>Model {pie.model_version}</span>
              {pie.state_timestamp ? <span>Updated {new Date(pie.state_timestamp).toLocaleString()}</span> : null}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-slate-500">
            PIE has not produced a candidate state yet.
          </div>
        )}
      </section>

      {pie ? (
        <section className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.06] via-[#081224]/80 to-[#081224]/70 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">PIE interpretation</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">
                {pie.capability >= 0.75
                  ? 'Capability is holding.'
                  : pie.calibration < 0.45
                    ? 'Your confidence needs calibration.'
                    : pie.timing < 0.45
                      ? 'Timing control is the current signal.'
                      : 'PIE is still building your state.'}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {pie.evidence_level === 'INSUFFICIENT'
                  ? 'PIE is collecting behavioural evidence. Treat early signals as directional, not final.'
                  : pie.calibration < 0.45
                    ? 'Your recent confidence signal is less aligned with outcomes than the other tracked dimensions.'
                    : pie.timing < 0.45
                      ? 'Response-time behaviour is currently weaker than the other dimensions in your PIE state.'
                      : 'The current state is stable enough to guide the next practice decision.'}
              </p>
            </div>
            <Link to="/practice" className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/15">
              Act on this signal <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">State sequence</p>
              <p className="mt-2 font-mono text-lg text-white">#{pie.state_sequence}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Evidence</p>
              <p className="mt-2 text-sm font-semibold text-white">{pie.evidence_level.replace(/_/g, ' ')}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Model</p>
              <p className="mt-2 truncate font-mono text-sm text-white">{pie.model_version}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-emerald-400/15 bg-[#081224]/75 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-white">Confidence Intelligence</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Calibration measures how closely your confidence matches whether the answer was actually correct. It is not a confidence-in-you score.</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold text-emerald-300">{confidence.confidence_attempts ? `${Math.round(confidence.calibration)}%` : '—'}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-600">Calibration</p>
          </div>
        </div>

        {confidence.confidence_attempts ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SignalCard label="Confidence" value={`${(confidence.average_confidence / 25 + 1).toFixed(1)}/5`} helper={`${confidence.confidence_attempts} confidence-rated attempts.`} accent="cyan" />
              <SignalCard label="Bias" value={`${confidence.bias > 0 ? '+' : ''}${Math.round(confidence.bias)} pts`} helper={confidence.bias > 5 ? 'Pattern leans overconfident.' : confidence.bias < -5 ? 'Pattern leans underconfident.' : 'Confidence and outcomes are broadly aligned.'} accent="purple" />
              <SignalCard label="High-confidence errors" value={`${confidence.high_confidence_wrong}`} helper="Confidence 4–5 followed by an incorrect answer." accent="rose" />
              <SignalCard label="Low-confidence correct" value={`${confidence.low_confidence_correct}`} helper="Confidence 1–2 followed by a correct answer." accent="emerald" />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Confidence → outcome</p>
                  <span className="text-[10px] text-slate-600">1 low · 5 high</span>
                </div>
                <div className="mt-4 space-y-3">
                  {confidence.levels.map(level => (
                    <div key={level.level}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-400">{level.level} · {level.label}</span>
                        <span className="font-mono text-slate-500">{level.accuracy}% correct · {level.attempts}</span>
                      </div>
                      <ProgressBar value={level.accuracy} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Calibration trend</p>
                <div className="mt-4 flex items-end gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">Previous</p>
                    <p className="mt-1 font-display text-xl text-white">{confidence.prior_calibration ? `${Math.round(confidence.prior_calibration)}%` : '—'}</p>
                  </div>
                  <ArrowRight className="mb-1 h-4 w-4 text-slate-600" />
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">Recent</p>
                    <p className="mt-1 font-display text-xl text-emerald-300">{confidence.recent_calibration ? `${Math.round(confidence.recent_calibration)}%` : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">Change</p>
                    <p className={cn('mt-1 font-mono text-sm', confidence.calibration_delta >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{confidence.calibration_delta > 0 ? '+' : ''}{Math.round(confidence.calibration_delta)} pts</p>
                  </div>
                </div>
              </div>
            </div>

            {confidence.subjects.length ? (
              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Calibration by subject</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {confidence.subjects.slice(0, 6).map(item => (
                    <div key={item.subject} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-white">{item.subject}</span>
                        <span className="font-mono text-xs text-emerald-300">{Math.round(item.calibration)}%</span>
                      </div>
                      <div className="mt-2"><ProgressBar value={item.calibration} /></div>
                      <p className="mt-2 text-[10px] text-slate-600">{item.attempts} attempts · {Math.round(item.accuracy)}% accuracy · bias {item.bias > 0 ? '+' : ''}{Math.round(item.bias)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">Confidence intelligence starts when you rate confidence on answered MCQs.</div>
        )}
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
  const [pie, setPie] = useState<PieState | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceIntelligence>({
    confidence_attempts: 0, calibration: 0, average_confidence: 0, accuracy: 0, bias: 0,
    overconfidence: 0, underconfidence: 0, high_confidence_wrong: 0, low_confidence_correct: 0,
    recent_calibration: 0, prior_calibration: 0, calibration_delta: 0, levels: [], subjects: [],
  });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // Refresh the PIE shadow runtime from the user's latest attempts.
      // The Edge Function is the only candidate-facing read boundary for PIE.
      const { data: pieBridge } = await supabase.functions.invoke('pie-shadow-sync');

      const [profileRes, attemptsRes, confidenceRes] = await Promise.all([
        supabase
          .from('readiness_dna')
          .select('readiness_score, clinical_accuracy, answer_stability, time_management')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_attempts')
          .select('is_correct, answer_changes_count, confidence_level, created_at, questions(category, subtopic)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(2000),
        (supabase.rpc as any)('get_confidence_intelligence'),
      ]);

      if (cancelled) return;

      const bridgePie = (pieBridge?.pie ?? null) as PieState | null;
      setPie(bridgePie);

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

      const confidenceData = (confidenceRes.data || {}) as Partial<ConfidenceIntelligence>;
      const canonicalConfidence: ConfidenceIntelligence = {
        confidence_attempts: Number(confidenceData.confidence_attempts || 0),
        calibration: Number(confidenceData.calibration || 0),
        average_confidence: Number(confidenceData.average_confidence || 0),
        accuracy: Number(confidenceData.accuracy || 0),
        bias: Number(confidenceData.bias || 0),
        overconfidence: Number(confidenceData.overconfidence || 0),
        underconfidence: Number(confidenceData.underconfidence || 0),
        high_confidence_wrong: Number(confidenceData.high_confidence_wrong || 0),
        low_confidence_correct: Number(confidenceData.low_confidence_correct || 0),
        recent_calibration: Number(confidenceData.recent_calibration || 0),
        prior_calibration: Number(confidenceData.prior_calibration || 0),
        calibration_delta: Number(confidenceData.calibration_delta || 0),
        levels: Array.isArray(confidenceData.levels) ? confidenceData.levels : [],
        subjects: Array.isArray(confidenceData.subjects) ? confidenceData.subjects : [],
      };

      setSubjects(subjectRows);
      setPriorities(priorityRows.sort((a, b) => b.score - a.score).slice(0, 6));
      setTrend(trendValues);
      setConfidence(canonicalConfidence);

      setSnapshot({
        readiness: Number(profileRes.data?.readiness_score || 0),
        accuracy: Number(profileRes.data?.clinical_accuracy || 0),
        stability: Number(profileRes.data?.answer_stability || 0),
        timing: Number(profileRes.data?.time_management || 0),
        calibration: canonicalConfidence.calibration,
        attempts: attempts.length,
        confidenceAttempts: canonicalConfidence.confidence_attempts,
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
              confidence={confidence}
              pie={pie}
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

