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
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some(t => t.id === requested) ? requested! : 'performance'
  );

  const handleTab = (tab: TabId) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const activeIndex = TABS.findIndex(t => t.id === activeTab);

  return (
    <AppLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl space-y-6"
      >
        <motion.div variants={reveal}>
          <RoomHeader kind="intelligence" />
        </motion.div>

        <motion.nav
          variants={reveal}
          aria-label="Performance Intelligence sections"
          className="grid grid-cols-3 rounded-2xl border border-white/10 bg-[#07101e]/90 p-1.5 backdrop-blur-xl"
        >
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all',
                  active
                    ? 'bg-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,.16)]'
                    : 'text-slate-500 hover:bg-white/[0.025] hover:text-slate-300'
                )}
              >
                <span className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border',
                  active ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300' : 'border-white/8 bg-white/[0.02] text-slate-500'
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <span>{tab.label}</span>
                {active && (
                  <span className="absolute inset-x-1/4 -bottom-1 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,.8)]" />
                )}
                {index < TABS.length - 1 && !active && (
                  <span className="pointer-events-none absolute right-0 hidden h-5 w-px bg-white/8 sm:block" />
                )}
              </button>
            );
          })}
        </motion.nav>

        <div className="min-h-[620px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={
                <div className="rounded-3xl border border-white/10 bg-[#081224]/70 p-12 text-center text-sm text-slate-500 backdrop-blur-xl">
                  Loading intelligence…
                </div>
              }>
                {activeTab === 'performance' && <ProfileContent />}
                {activeTab === 'behavior' && <BehaviorContent />}
                {activeTab === 'trust-your-gut' && <TrustYourGutContent />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="sr-only" aria-live="polite">
          Section {activeIndex + 1} of {TABS.length}: {TABS[activeIndex]?.label}
        </div>
      </motion.div>
    </AppLayout>
  );
}
