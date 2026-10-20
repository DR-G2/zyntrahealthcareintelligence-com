import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { RoomHeader } from '@/components/RoomHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Link2, Unplug, Loader2, History, ShieldCheck, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

type Dimension = { key: string; label: string; status: 'available' | 'building' | 'unavailable'; valuePercent: number | null; evidenceCount: number | null; uncertaintyPercent: number | null; lowerPercent: number | null; upperPercent: number | null; latestObservationAt: string | null; confidenceLevelCounts: Record<string, number | null> | null };
type Source = { key: string; label: string; valuePercent: number | null; evidenceCount: number | null; uncertaintyPercent: number | null; latestObservationAt: string | null };
type ModeEvidence = { mode: string; modeLabel: string; dimensions: Dimension[] };
type PiePayload = { modeEvidence: ModeEvidence[]; overallStatus: string; confidenceChecklist: Array<{ mode: string; modeLabel: string; level: number; count: number | null }>; nextAction: { title: string; reason: string } | null; sources: Source[]; snapshotAt: string | null };
type Session = { id: string; mode: string; provider: string; model: string | null; created_at: string; status: string; error_code?: string | null; response_text?: string | null; prompt?: string | null };
const FUNCTION_NAME = 'v2-ai-lab';
const FALLBACK = 'I can only explain what your Performance Intelligence page shows. Try asking what a section means.';
const ERROR_LABELS: Record<string, string> = { INVALID_PROVIDER_KEY: 'OpenAI rejected the API key.', PROVIDER_ACCESS_DENIED: 'The key does not have access to this OpenAI resource.', PROVIDER_RATE_LIMIT: 'OpenAI rate limit or quota reached.', INVALID_MODEL_RESPONSE: 'OpenAI returned a response that could not be safely used.', ENCRYPTION_SECRET_MISSING: 'AI Lab key encryption is not configured.', CONFIGURATION_ERROR: 'The saved OpenAI connection needs attention.', PROVIDER_ERROR: 'OpenAI could not complete this request.', DATABASE_ERROR: 'AI Lab could not save or load this session.', PIE_UNAVAILABLE: 'The PIE snapshot could not be loaded.' };

export default function AILab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [pie, setPie] = useState<PiePayload | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const canRun = useMemo(() => connected && !!model && !!prompt.trim() && !loading, [connected, model, prompt, loading]);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { getSupabaseV2 } = await import('@/integrations/supabase/v2-client');
    const { data, error } = await getSupabaseV2().functions.invoke(FUNCTION_NAME, { body });
    if (error) {
      let message = error.message || 'AI Lab request failed.';
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try { const payload = await context.json(); if (typeof payload?.error === 'string') message = payload.error; } catch { /* keep client error */ }
      }
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || 'AI Lab request failed.');
    return data;
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await invoke({ action: 'history' });
      if (Array.isArray(data.sessions)) setHistory(data.sessions);
    } catch (e) { setConnectionMessage(e instanceof Error ? e.message : 'AI Lab history is temporarily unavailable.'); }
  }, [invoke]);

  const loadStatus = useCallback(async () => {
    try {
      const data = await invoke({ action: 'status', provider: 'openai' });
      const available = Array.isArray(data.models) ? data.models.filter((v: unknown): v is string => typeof v === 'string') : [];
      setConnected(Boolean(data.connected)); setModels(available);
      setModel(current => available.includes(current) ? current : data.model || available[0] || '');
      setConnectionMessage(data.connected ? 'OpenAI connection verified.' : 'Connect an OpenAI API key to explain your PIE.');
    } catch (e) {
      setConnected(false); setConnectionMessage(e instanceof Error ? e.message : 'OpenAI connection status could not be loaded.');
    }
  }, [invoke]);
  useEffect(() => { void loadStatus(); void loadHistory(); }, [loadStatus, loadHistory]);

  const connect = async () => {
    if (!apiKey.trim()) { toast({ title: 'OpenAI API key required', description: 'Paste your OpenAI API key.', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const data = await invoke({ action: 'connect', provider: 'openai', api_key: apiKey.trim() });
      const available = Array.isArray(data.models) ? data.models.filter((v: unknown): v is string => typeof v === 'string') : [];
      setModels(available); setModel(data.model || available[0] || ''); setConnected(true); setApiKey('');
      setConnectionMessage('OpenAI connection verified.');
      toast({ title: 'OpenAI connected', description: 'Your key was verified and stored encrypted.' });
    } catch (e) { toast({ title: 'Connection failed', description: e instanceof Error ? e.message : 'OpenAI could not be connected.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await invoke({ action: 'disconnect', provider: 'openai' });
      setConnected(false); setModels([]); setModel(''); setApiKey(''); setResult(''); setPie(null); setSources([]);
      setConnectionMessage('OpenAI disconnected. Your AI Lab history remains available.');
      toast({ title: 'OpenAI disconnected' });
    } catch (e) { toast({ title: 'Disconnect failed', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const run = async (question = prompt.trim()) => {
    if (!connected || !model || !question.trim() || loading) return;
    setLoading(true); setResult(''); setSources([]); setPie(null);
    try {
      const data = await invoke({ action: 'run', provider: 'openai', model, mode: 'performance', prompt: question.trim() });
      setResult(typeof data.result === 'string' ? data.result : FALLBACK);
      setPie(data.pie && typeof data.pie === 'object' ? data.pie as PiePayload : null);
      setSources(Array.isArray(data.sources) ? data.sources as Source[] : []);
      setSnapshotAt(typeof data.snapshot_at === 'string' ? data.snapshot_at : null);
      setLastPrompt(question.trim()); setPrompt('');
      await loadHistory();
    } catch (e) { toast({ title: 'AI Lab error', description: e instanceof Error ? e.message : 'Unable to explain PIE.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const shownHistory = showAllHistory ? history : history.slice(0, 5);
  const snapshotLabel = snapshotAt || pie?.snapshotAt ? new Date((snapshotAt || pie?.snapshotAt) as string).toLocaleString() : 'unavailable';

  return <AppLayout><div className="mx-auto max-w-5xl space-y-6">
    <RoomHeader kind="ai-lab" />
    <header className="space-y-2"><p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Zyntra · AI Lab V1</p><h1 className="text-3xl font-semibold tracking-tight">Explain my PIE</h1><p className="max-w-3xl text-sm leading-6 text-muted-foreground">Ask what your Performance Intelligence page means. Answers use only your candidate-facing PIE snapshot. AI Lab does not score, rank or predict you.</p></header>
    <Card className="border-white/10 bg-[#081224]/70"><CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-cyan-300" />OpenAI connection</CardTitle><CardDescription>Bring your own OpenAI API key. Model usage is billed by OpenAI under your account.</CardDescription></CardHeader><CardContent className="space-y-4">
      {!connected ? <div className="space-y-3"><div className="space-y-2"><Label htmlFor="provider-key">OpenAI API key</Label><Input id="provider-key" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste your OpenAI API key" /></div><Button onClick={connect} disabled={loading || !apiKey.trim()} className="w-full sm:w-auto">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Test & connect</Button><p className="text-xs leading-5 text-muted-foreground">Your key is sent to the authenticated AI Lab function, verified against OpenAI, and encrypted before storage. It is not included in the model prompt.</p></div> : <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"><div><p className="font-medium">OpenAI connected</p><p className="text-xs text-muted-foreground">API access verified</p></div><Badge variant="outline">Connected</Badge></div>
        <div className="space-y-2"><Label>Model</Label><Select value={model} onValueChange={setModel}><SelectTrigger><SelectValue placeholder="Select an available OpenAI model" /></SelectTrigger><SelectContent>{models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setConnected(false); setApiKey(''); }} disabled={loading}>Replace key</Button><Button variant="outline" onClick={disconnect} disabled={loading}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button></div>
      </div>}
      <p role="status" className="text-xs text-muted-foreground">{connectionMessage}</p>
    </CardContent></Card>
    <Card className="border-white/10 bg-[#081224]/70"><CardHeader><CardTitle>Ask about your PIE</CardTitle><CardDescription>Try “What does calibration mean?”, “Why is this dimension still building?”, or “What does my next action mean?”</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label htmlFor="ai-prompt">Your question</Label><Textarea id="ai-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask about a label, evidence status, uncertainty, or next action…" className="min-h-28" maxLength={2000} /></div>
      <Button className="w-full sm:w-auto" onClick={() => void run()} disabled={!canRun}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Explain my PIE</Button>
      {!connected && <p className="text-xs text-muted-foreground">Connect an OpenAI key to begin. Your existing AI Lab history is retained.</p>}
      {result && <div className="space-y-4 rounded-2xl border border-cyan-400/15 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-300">PIE explanation</p><Badge variant="outline">Based on your PIE</Badge></div><div className="whitespace-pre-wrap text-sm leading-7">{result}</div>
        {sources.length > 0 && <div className="flex flex-wrap gap-2">{sources.map(source => <span key={source.key} className="rounded-full border border-cyan-400/20 px-3 py-1.5 text-xs text-cyan-200">{source.label}{source.valuePercent !== null ? String(source.valuePercent) + '%' : ''}{source.evidenceCount !== null ? ' · ' + String(source.evidenceCount) + ' observations' : ''}</span>)}</div>}
        <p className="text-xs text-muted-foreground">Based on your Performance Intelligence as of {snapshotLabel}.</p>
        {pie && <div className="space-y-3 border-t border-white/10 pt-4"><h3 className="text-sm font-medium">Evidence planner</h3><div className="space-y-4">{pie.modeEvidence.map(group => <section key={group.mode} className="space-y-2"><h4 className="text-sm font-medium">{group.modeLabel}</h4><div className="grid gap-2 sm:grid-cols-2">{group.dimensions.map(d => <div key={d.key} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 p-3"><div><p className="text-sm">{d.label}</p><p className="text-xs text-muted-foreground">{d.status === 'available' && d.valuePercent !== null ? String(d.valuePercent) + '% available' : d.status === 'building' ? d.evidenceCount === null ? 'Building, evidence count unavailable' : 'Building, ' + String(d.evidenceCount) + ' of 50' : 'Evidence unavailable'}</p></div><Badge variant="outline">{d.status === 'available' ? 'Available' : d.status === 'building' ? 'Building' : 'Unavailable'}</Badge></div>)}</div></section>)}</div>
          {pie.confidenceChecklist.length > 0 && <div className="space-y-2"><p className="text-sm font-medium">Calibration evidence by confidence level</p>{pie.confidenceChecklist.map(item => <p key={item.mode + item.level} className="text-xs text-muted-foreground">{item.modeLabel} · Level {item.level}: {item.count === null ? 'count unavailable' : String(item.count) + ' of 15 observations'}</p>)}</div>}
          {pie.nextAction && <div className="rounded-lg border border-white/10 p-3"><p className="text-sm font-medium">PIE next action: {pie.nextAction.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{pie.nextAction.reason}</p></div>}
          <Button variant="outline" onClick={() => navigate('/practice')}>Go to Practice <ExternalLink className="ml-2 h-4 w-4" /></Button><p className="text-xs text-muted-foreground">Practice opens normally. This planner does not preselect questions or change session settings.</p>
        </div>}
      </div>}
      {lastPrompt && <Button variant="ghost" size="sm" onClick={() => void run(lastPrompt)} disabled={loading || !connected || !model}><RefreshCw className="mr-2 h-4 w-4" />Retry last question</Button>}
    </CardContent></Card>
    <Card className="border-white/10 bg-[#081224]/70"><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-cyan-300" />Recent AI Lab</CardTitle><CardDescription>Old tool sessions remain in history. Retired tools are labelled and cannot be started again.</CardDescription></CardHeader><CardContent className="space-y-3">
      {history.length ? shownHistory.map(session => { const retired = session.mode !== 'performance'; const open = expandedSession === session.id; const errorText = session.error_code ? ERROR_LABELS[session.error_code] || `Session error: ${session.error_code}` : null; return <div key={session.id} className="rounded-xl border border-white/10 p-3">
        <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setExpandedSession(open ? null : session.id)}><span className="min-w-0"><span className="block text-sm font-medium">{retired ? 'Retired tool' : 'Explain my PIE'}</span><span className="block break-words text-xs text-muted-foreground">{session.provider} · {session.model || 'Model unavailable'} · {new Date(session.created_at).toLocaleString()}</span></span><span className="flex shrink-0 items-center gap-2"><Badge variant="outline">{session.status}</Badge>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span></button>
        {open && <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-sm">{errorText && <p className="text-destructive">{errorText}</p>}{session.prompt && <p className="text-muted-foreground"><span className="font-medium text-foreground">Question: </span>{session.prompt}</p>}{session.response_text && <p className="whitespace-pre-wrap leading-6">{session.response_text}</p>}{retired && <p className="text-xs text-muted-foreground">This tool has been retired. Existing records are preserved for reference.</p>}{session.status === 'error' && session.prompt && !retired && <Button size="sm" variant="outline" disabled={!connected || loading} onClick={() => void run(session.prompt || '')}>Retry this question</Button>}</div>}
      </div>; }) : <p className="text-sm text-muted-foreground">No AI Lab sessions found.</p>}
      {history.length > 5 && <Button variant="ghost" size="sm" onClick={() => setShowAllHistory(v => !v)}>{showAllHistory ? 'Show less' : 'Show all sessions'}</Button>}
    </CardContent></Card>
    <p className="text-xs leading-5 text-muted-foreground">AI Lab explains only candidate-facing PIE information. It does not provide clinical teaching, generate questions, calculate scores, rank candidates, or predict exam outcomes. OpenAI usage is billed by OpenAI under your own account.</p>
  </div></AppLayout>;
}
