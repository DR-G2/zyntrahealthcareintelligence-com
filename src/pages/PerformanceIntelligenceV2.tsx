import { lazy, Suspense, useEffect, useState } from 'react';
import { Activity, Brain, Target } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { ReadinessPrism } from '@/components/intelligence/ReadinessPrism';
import { loadIntelligenceEvidence, type IntelligenceEvidence } from '@/lib/pie/intelligence-evidence';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const BehaviorContent = lazy(() => import('./BehaviorProfile'));
const TrustYourGutContent = lazy(() => import('./TrustYourGut'));
const TABS = [
  { id: 'performance', label: 'Performance', icon: Activity },
  { id: 'behavior', label: 'Behaviour', icon: Brain },
  { id: 'trust-your-gut', label: 'Trust Your Gut', icon: Target },
] as const;

export default function PerformanceIntelligence() {
  const { user } = useAuth();
  const userId = user?.id;
  const [params, setParams] = useSearchParams();
  const tab = TABS.find(item => item.id === params.get('tab'))?.id ?? 'performance';
  const [evidence, setEvidence] = useState<IntelligenceEvidence | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setEvidence(null);
    setOwner(null);
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    // Existing caller-owned read contracts only. Never rebuild or fetch shadow diagnostics.
    loadIntelligenceEvidence().then(result => {
      if (cancelled) return;
      setEvidence(result); setOwner(userId); setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      const unavailable = { status: 'unavailable', value: null } as const;
      setEvidence({ pie: unavailable, history: unavailable, stability: unavailable, confidence: unavailable, action: unavailable });
      setOwner(userId);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId, retry]);
  const ownEvidence = userId === owner ? evidence : null;
  return <AppLayout><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
      <div><p className="mb-2 font-mono text-xs uppercase text-primary">Zyntra · Candidate intelligence</p><h1 className="font-display text-3xl font-medium leading-tight">Performance Intelligence</h1></div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-4 w-4 text-primary" /> Evidence-led preparation</p>
    </header>
    <div role="tablist" aria-label="Intelligence views" className="grid grid-cols-3 gap-1 border-b border-border/60 pb-3">{TABS.map(item => <Button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} variant="ghost" className={cn('min-h-11 min-w-0 whitespace-normal px-2 text-xs sm:text-sm', tab === item.id ? 'bg-accent text-primary' : 'text-muted-foreground')} onClick={() => setParams({ tab: item.id }, { replace: true })} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = TABS.findIndex(t => t.id === item.id);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (current + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      const target = TABS[next];
      setParams({ tab: target.id }, { replace: true });
      document.getElementById(`tab-${target.id}`)?.focus();
    }} tabIndex={tab === item.id ? 0 : -1}><item.icon className="hidden sm:block" />{item.label}</Button>)}</div>
    <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab === 'performance' ? <ReadinessPrism evidence={ownEvidence} loading={loading} retry={() => setRetry(value => value + 1)} /> : <Suspense fallback={<p role="status" className="py-12 text-muted-foreground">Loading your evidence…</p>}>{tab === 'behavior' ? <BehaviorContent /> : <TrustYourGutContent />}</Suspense>}
    </div>
  </div></AppLayout>;
}
