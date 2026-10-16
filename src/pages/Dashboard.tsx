import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Network } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { WelcomeTour } from '@/components/WelcomeTour';
import { SubscriptionTimer } from '@/components/SubscriptionTimer';
import { NextBestStep, type NextBestStepSnapshot } from '@/components/NextBestStep';
import { DashboardStudyPriorities } from '@/components/dashboard/DashboardStudyPriorities';
import { DashboardTrends } from '@/components/dashboard/DashboardTrends';
import { DashboardResume } from '@/components/dashboard/DashboardResume';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function Dashboard() {
  const { profile } = useAuth();
  const gate = useFeatureGate();
  const [showTour, setShowTour] = useState(() => !localStorage.getItem(WelcomeTour.STORAGE_KEY));
  const [actionRetry, setActionRetry] = useState(0);
  const [actionSnapshot, setActionSnapshot] = useState<NextBestStepSnapshot>({ recommendation: null, loading: true, error: false });
  const onActionSnapshotChange = useCallback((snapshot: NextBestStepSnapshot) => setActionSnapshot(snapshot), []);
  const retryAction = useCallback(() => setActionRetry(value => value + 1), []);
  const daysUntilExam = useMemo(
    () => profile?.exam_date ? differenceInDays(parseISO(profile.exam_date), new Date()) : null,
    [profile?.exam_date],
  );

  return (
    <AppLayout>
      {showTour && <WelcomeTour userName={profile?.name?.split(' ')[0]} onComplete={() => setShowTour(false)} />}

      <div className="mx-auto w-full max-w-5xl space-y-7 pb-8">
        <header className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Candidate workspace</p>
            <h1 className="mt-2 text-3xl font-bold font-display text-white">Welcome back, {profile?.name?.split(' ')[0] || 'Doctor'}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {daysUntilExam !== null && daysUntilExam > 0 ? daysUntilExam + ' days until your exam' : 'Your next step, grounded in your recorded practice.'}
            </p>
          </div>
          <SubscriptionTimer />
        </header>

        <section aria-labelledby="dashboard-next-title" className="space-y-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">01 / Next best action</p><h2 id="dashboard-next-title" className="mt-1 font-display text-xl font-semibold text-white">What to do next</h2></div>
          <NextBestStep showEvidence={false} refreshKey={actionRetry} onSnapshotChange={onActionSnapshotChange} />
        </section>

        <section aria-labelledby="dashboard-evidence-title" className="space-y-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">02 / Evidence</p><h2 id="dashboard-evidence-title" className="mt-1 font-display text-xl font-semibold text-white">Why this is suggested</h2></div>
          <Card className="border-white/10 bg-white/[0.025]"><CardContent className="p-5">
            {actionSnapshot.loading ? (
              <div role="status" className="space-y-2"><span className="sr-only">Loading recommendation evidence</span><div className="h-4 w-3/4 animate-pulse rounded bg-white/10 motion-reduce:animate-none" /><div className="h-4 w-1/2 animate-pulse rounded bg-white/5 motion-reduce:animate-none" /></div>
            ) : actionSnapshot.error ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm leading-6 text-slate-300">The recommendation service could not be read, so there is no verified reason to display. This does not imply anything about exam readiness.</p>
                <Button variant="outline" onClick={retryAction} className="min-h-11">Retry recommendation</Button>
              </div>
            ) : actionSnapshot.recommendation ? (
              <div className="space-y-2">
                {actionSnapshot.recommendation.evidence_level && <p className="text-xs font-medium uppercase tracking-wider text-cyan-200">Evidence level: {actionSnapshot.recommendation.evidence_level}</p>}
                <p className="text-sm leading-6 text-slate-300">{actionSnapshot.recommendation.reason || 'The recommendation did not include an explanation, so no rationale is inferred.'}</p>
                <p className="text-xs leading-5 text-slate-500">This is a training suggestion, not an exam pass prediction or guarantee.</p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-300">No personalised recommendation was returned, so no reason is inferred. You can still practise or review your recorded priorities below.</p>
            )}
          </CardContent></Card>
        </section>

        <DashboardStudyPriorities />
        <DashboardTrends />
        <DashboardResume />

        {!gate.isPaid && !gate.loading && (
          <section aria-labelledby="dashboard-usage-title" className="space-y-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Account usage</p><h2 id="dashboard-usage-title" className="mt-1 font-display text-lg font-semibold text-white">Today's usage</h2></div>
            <Card className="border-white/10 bg-white/[0.025]">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-300">Available daily allowance</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'MCQ attempts', used: gate.mcqUsedToday, limit: gate.mcqDailyLimit },
                  { label: 'AI prompts', used: gate.promptsUsedToday, limit: gate.promptDailyLimit },
                ].map(({ label, used, limit }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-400">{label}</span><span className="font-medium tabular-nums text-slate-200">{used} / {limit}</span></div>
                    <Progress value={limit > 0 ? (used / limit) * 100 : 0} className="h-2" />
                  </div>
                ))}
                <Button variant="outline" asChild className="min-h-11 w-full sm:w-auto"><Link to="/pricing">View plans <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </CardContent>
            </Card>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/intelligence?tab=performance" className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none">
            <Network className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="block font-medium text-white">Detailed performance</span><span className="mt-1 block text-xs text-slate-400">Open PIE analytics</span></span>
            <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </Link>
          <Link to="/companion/ai-core" className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none">
            <Brain className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="block font-medium text-white">Zyntra AI Core</span><span className="mt-1 block text-xs text-slate-400">Explore the separate AI workspace</span></span>
            <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
