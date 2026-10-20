import { Activity, ArrowRight, Clock, History as HistoryIcon, Hammer, Target } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { MCQHistory } from '@/components/history/MCQHistory';
import { MCQReviewQueue } from '@/components/history/MCQReviewQueue';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type HistoryTab = 'all' | 'mcq' | 'osce' | 'review';

const TABS: { id: HistoryTab; label: string }[] = [
  { id: 'all', label: 'All activity' },
  { id: 'mcq', label: 'MCQ history' },
  { id: 'osce', label: 'OSCE history' },
  { id: 'review', label: 'Review Queue' },
];

export default function HistoryPage() {
  const gate = useFeatureGate();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: HistoryTab = requestedTab === 'mcq' || requestedTab === 'osce' || requestedTab === 'review' ? requestedTab : 'all';
  const reviewAttemptId = searchParams.get('attempt-review');

  // Preserve unrelated query parameters and the hash. Browser Back/Forward restores
  // the selected tab and expanded attempt without touching Practice's resume flow.
  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    navigate({
      pathname: location.pathname,
      search: params.toString() ? `?${params.toString()}` : '',
      hash: location.hash,
    });
  };

  const changeTab = (tab: HistoryTab) => updateParam('tab', tab === 'all' ? null : tab);

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-10 pt-4 sm:px-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
            <HistoryIcon className="h-4 w-4" aria-hidden="true" /> Your learning record
          </div>
          <h1 className="text-3xl font-bold font-display text-white sm:text-4xl">History</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Review your MCQ attempts, revisit explanations, and track the work you have completed.
          </p>
        </header>

        <section aria-label="History sections">
          <div role="tablist" aria-label="History type" className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:grid-cols-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="history-panel"
                onClick={() => changeTab(tab.id)}
                className={`min-h-11 rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:px-4 sm:text-sm ${activeTab === tab.id ? 'bg-cyan-300/10 text-cyan-100 ring-1 ring-inset ring-cyan-300/25' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <div id="history-panel" role="tabpanel" aria-label={TABS.find((tab) => tab.id === activeTab)?.label} className="space-y-5">
          {activeTab === 'review' ? (
            <section aria-label="MCQ review queue" className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-cyan-300/10 p-2 text-cyan-200"><Target className="h-5 w-5" aria-hidden="true" /></div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Review Queue</h2>
                  <p className="text-sm leading-6 text-slate-400">Questions Zyntra has identified as needing another look.</p>
                </div>
              </div>
              {gate.canAccessHistory ? (
                <MCQReviewQueue />
              ) : (
                <UpgradePrompt feature="Question Review Queue" description="Upgrade to access your personalised MCQ review queue." variant="card" />
              )}
            </section>
          ) : activeTab === 'osce' ? (
            <Card className="border-dashed border-white/15 bg-white/[0.025]">
              <CardContent className="flex flex-col items-center gap-4 px-5 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/20 bg-amber-300/10 text-amber-200">
                  <Hammer className="h-5 w-5" aria-hidden="true" />
                </div>
                <Badge variant="outline" className="border-amber-300/25 text-amber-200">Under Construction</Badge>
                <h2 className="text-xl font-semibold text-white">OSCE history is not available yet</h2>
                <p className="max-w-md text-sm leading-6 text-slate-400">
                  OSCE attempt history is being built. No OSCE records are shown until verified history data is available.
                </p>
                <Button asChild variant="outline"><Link to="/practice">Back to Practice <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {activeTab === 'all' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="border-white/10 bg-white/[0.025]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="rounded-lg bg-cyan-300/10 p-2 text-cyan-200"><Activity className="h-5 w-5" aria-hidden="true" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">MCQ attempts</p>
                        <p className="text-xs text-slate-400">Available in your activity history</p>
                      </div>
                      <Badge variant="outline" className="border-emerald-300/20 text-emerald-200">Available</Badge>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-white/[0.025]">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="rounded-lg bg-amber-300/10 p-2 text-amber-200"><Clock className="h-5 w-5" aria-hidden="true" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">OSCE attempts</p>
                        <p className="text-xs text-slate-400">History support is still being built</p>
                      </div>
                      <Badge variant="outline" className="border-amber-300/20 text-amber-200">Coming later</Badge>
                    </CardContent>
                  </Card>
                </div>
              )}
              {gate.canAccessHistory ? (
                <section aria-label="MCQ attempt history" className="space-y-3">
                  {activeTab === 'all' && <h2 className="text-lg font-semibold text-white">Recent MCQ activity</h2>}
                  {activeTab === 'mcq' && <h2 className="text-lg font-semibold text-white">MCQ history</h2>}
                  <MCQHistory
                    showStartPracticeCta
                    expandedAttemptId={reviewAttemptId}
                    onExpandedAttemptChange={(id) => updateParam('attempt-review', id)}
                  />
                  <p className="text-xs text-slate-500">History is loaded through the authenticated history service and displays the most recent 2,000 attempts, with local pagination.</p>
                </section>
              ) : (
                <UpgradePrompt feature="Question History" description="Upgrade to review your complete attempt history." variant="card" />
              )}
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
