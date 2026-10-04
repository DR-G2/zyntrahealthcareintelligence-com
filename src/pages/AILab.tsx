import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { RoomHeader } from '@/components/RoomHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Sparkles, Target, Link2, Unplug, Loader2, History, ShieldCheck } from 'lucide-react';

type Mode = 'performance' | 'questions' | 'weak-area';
type QuestionResult = { stem: string; options: string[]; correct_answer: string; explanation: string };

const MODES = [
  { id: 'performance' as const, label: 'Ask My Performance', description: 'Ask questions about your current training patterns.', icon: MessageSquare },
  { id: 'questions' as const, label: 'Generate Questions', description: 'Create AI-generated AMC-style practice questions.', icon: Sparkles },
  { id: 'weak-area' as const, label: 'Weak Area Drill', description: 'Turn current weak areas into a focused training session.', icon: Target },
];

export default function AILab() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('performance');
  const [useIntelligence, setUseIntelligence] = useState(false);
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [subject, setSubject] = useState('');
  const [focus, setFocus] = useState('');
  const [difficulty, setDifficulty] = useState('moderate');
  const [questionCount, setQuestionCount] = useState('5');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | QuestionResult[] | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; mode: string; provider: string; model: string | null; created_at: string; status: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const loggedExplanations = useRef<Set<number>>(new Set());
  const startedQuestions = useRef<Set<number>>(new Set());

  const canRun = useMemo(
    () => connected && !!model && (mode !== 'performance' || !!prompt.trim()) && (mode !== 'questions' || !!subject.trim()),
    [connected, model, mode, prompt, subject],
  );

  const loadHistory = async () => {
    try {
      const data = await invoke({ action: 'history', provider: 'openai' });
      if (Array.isArray(data.sessions)) setHistory(data.sessions);
    } catch {
      // History is supplementary; the main AI Lab flow should remain usable if it cannot load.
    }
  };

  const logEvent = async (event_type: string, extra: Record<string, unknown> = {}) => {
    if (!sessionId) return;
    try {
      await invoke({ action: 'log_event', provider: 'openai', session_id: sessionId, event_type, ...extra });
    } catch {
      // Telemetry failure must never block training.
    }
  };

  useEffect(() => {
    void (async () => {
      await loadHistory();
      try {
        const data = await invoke({ action: 'status', provider: 'openai' });
        if (data.connected) {
          const available = Array.isArray(data.models) ? data.models.filter((m: unknown): m is string => typeof m === 'string') : [];
          setConnected(true);
          setModels(available);
          setModel(data.model || available[0] || '');
        }
      } catch {
        // A missing connection is a normal first-visit state.
      }
    })();
  }, []);

  const invoke = async (body: Record<string, unknown>) => {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.functions.invoke('ai-lab', { body });

    if (error) {
      let message = error.message || 'AI Lab Edge Function request failed.';
      const context = (error as { context?: Response }).context;

      if (context && typeof context.json === 'function') {
        try {
          const payload = await context.json();
          if (typeof payload?.error === 'string') message = payload.error;
          else if (typeof payload?.message === 'string') message = payload.message;
        } catch {
          // Keep the Supabase client error when the response body is unavailable.
        }
      }

      throw new Error(message);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'AI Lab request failed');
    }

    return data;
  };

  const connect = async () => {
    if (!apiKey.trim()) return toast({ title: 'API key required', description: 'Enter your OpenAI API key.', variant: 'destructive' });
    setLoading(true);
    try {
      const data = await invoke({ action: 'connect', provider: 'openai', api_key: apiKey.trim() });
      const available = Array.isArray(data.models) ? data.models.filter((m: unknown): m is string => typeof m === 'string') : [];
      setModels(available);
      setModel(data.model || available[0] || '');
      setConnected(true);
      setApiKey('');
      toast({ title: 'OpenAI connected', description: 'API access verified on the server.' });
    } catch (e: any) {
      toast({ title: 'Connection failed', description: e?.message || 'Unable to verify the provider.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await invoke({ action: 'disconnect', provider: 'openai' });
      setConnected(false);
      setModels([]);
      setModel('');
      setResult(null);
      setSessionId(null);
      setSelectedAnswers({});
      toast({ title: 'OpenAI disconnected' });
    } catch (e: any) {
      toast({ title: 'Disconnect failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const run = async () => {
    if (!canRun) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await invoke({
        action: 'run',
        provider: 'openai',
        model,
        mode,
        use_intelligence: useIntelligence,
        prompt: mode === 'performance' ? prompt.trim() : undefined,
        generation: mode === 'questions'
          ? { subject: subject.trim(), focus: focus.trim(), difficulty, count: Number(questionCount) }
          : undefined,
      });
      setResult(data.result ?? null);
      setSessionId(typeof data.session_id === 'string' ? data.session_id : null);
      setSelectedAnswers({});
      loggedExplanations.current.clear();
      startedQuestions.current.clear();
      await loadHistory();
      if (mode === 'performance') setPrompt('');
      toast({ title: 'AI Lab session complete' });
    } catch (e: any) {
      toast({ title: 'AI Lab error', description: e?.message || 'Unable to complete the session.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return <AppLayout><div className="space-y-6">
    <RoomHeader kind="ai-lab" />
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <Card className="border-white/10 bg-[#081224]/70">
          <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-cyan-300" />Connected AI</CardTitle><CardDescription>V1 uses OpenAI with your own API credential. Zyntra does not pay the provider's inference bill.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {!connected ? <><div className="space-y-2"><Label htmlFor="openai-key">OpenAI API key</Label><Input id="openai-key" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-••••••••" /><p className="text-xs leading-5 text-slate-500">Your key is sent to the secure AI Lab function for verification and encrypted server-side. Zyntra cannot verify your provider billing status.</p></div><Button onClick={connect} disabled={loading} className="w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Test & Connect</Button><p className="text-xs leading-5 text-slate-500">AI Lab uses your own external AI provider credentials. Zyntra routes AI Lab requests through its secure server infrastructure and may store AI Lab session and usage telemetry to support your training experience. Your external provider account and billing remain your responsibility.</p></> :
            <><div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"><div><div className="text-sm font-medium text-white">OpenAI</div><div className="text-xs text-slate-400">API access verified</div></div><Badge variant="outline" className="border-emerald-400/30 text-emerald-300">Connected</Badge></div>
            <div className="space-y-2"><Label>Model</Label><Select value={model} onValueChange={setModel}><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger><SelectContent>{models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <Button variant="outline" onClick={disconnect} disabled={loading} className="w-full"><Unplug className="mr-2 h-4 w-4" />Disconnect</Button></>}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#081224]/70">
          <CardHeader><CardTitle>Training Context</CardTitle><CardDescription>External AI can receive only the bounded Performance Intelligence fields shown by Zyntra.</CardDescription></CardHeader>
          <CardContent className="flex items-center justify-between gap-4"><div><div className="text-sm font-medium text-white">Use my Performance Intelligence</div><div className="text-xs leading-5 text-slate-400">Off sends only your immediate request. On adds a bounded Zyntra training summary such as performance, weak areas, timing and behaviour signals. It never sends your API key or question-bank data.</div></div><Switch checked={useIntelligence} onCheckedChange={setUseIntelligence} /></CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#081224]/70">
        <CardHeader><div className="flex flex-wrap gap-2">{MODES.map(({id,label,icon:Icon}) => <Button key={id} size="sm" variant={mode===id?'default':'outline'} onClick={()=>{setMode(id);setResult(null);}} className="gap-2"><Icon className="h-4 w-4"/>{label}</Button>)}</div><CardTitle className="mt-4">{MODES.find(m=>m.id===mode)?.label}</CardTitle><CardDescription>{MODES.find(m=>m.id===mode)?.description}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {mode==='performance' && <div className="space-y-2"><Label htmlFor="ai-prompt">Ask your question</Label><Textarea id="ai-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Why am I losing marks?" className="min-h-32"/></div>}
          {mode==='questions' && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Adult Medicine"/></div><div className="space-y-2"><Label>Focus / subtopic</Label><Input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="Acute coronary syndrome"/></div><div className="space-y-2"><Label>Difficulty</Label><Select value={difficulty} onValueChange={setDifficulty}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="difficult">Difficult</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Questions</Label><Select value={questionCount} onValueChange={setQuestionCount}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="3">3</SelectItem><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem></SelectContent></Select></div></div>}
          {mode==='weak-area' && <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-4 text-sm text-slate-300">Zyntra will select the training focus from your current Performance Intelligence context. Enable Training Context to personalize it.</div>}
          <Button className="w-full" onClick={run} disabled={loading || !canRun}><Sparkles className="mr-2 h-4 w-4"/>{loading?'Running…':'Start AI Session'}</Button>

          {result && <div className="space-y-3 rounded-2xl border border-cyan-400/15 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3"><div className="text-xs font-mono uppercase tracking-[0.16em] text-cyan-300">AI output</div><Badge variant="outline">{model}</Badge></div>
            {Array.isArray(result) ? result.map((q, i) => <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><div className="mb-3 text-sm font-medium text-white">Question {i + 1}</div><p className="text-sm leading-6 text-slate-200">{q.stem}</p><div className="mt-3 space-y-2">{q.options.map((option, j) => { const selected = selectedAnswers[i] === option; return <button key={j} type="button" onClick={() => { const previous = selectedAnswers[i]; setSelectedAnswers((current) => ({ ...current, [i]: option })); if (!startedQuestions.current.has(i)) { startedQuestions.current.add(i); void logEvent('question_started', { question_index: i }); } void logEvent(previous && previous !== option ? 'answer_changed' : 'answer_submitted', { question_index: i, answer_changes: previous && previous !== option ? 1 : 0 }); }} className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${selected ? 'border-cyan-400/50 bg-cyan-400/10 text-white' : 'border-white/10 text-slate-300 hover:border-cyan-400/30 hover:bg-white/[0.03]'}`}>{option}</button>; })}</div><details className="mt-3" onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open && !loggedExplanations.current.has(i)) { loggedExplanations.current.add(i); void logEvent('explanation_requested', { question_index: i }); } }}><summary className="cursor-pointer text-xs text-cyan-300">Reveal answer & explanation</summary><div className="mt-2 text-sm leading-6 text-slate-300"><strong className="text-white">{q.correct_answer}</strong><div className="mt-1">{q.explanation}</div></div></details></div>) :
              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{result}</div>}
          </div>}
        </CardContent>
      </Card>
    </div>

    <Card className="border-white/10 bg-[#081224]/70"><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-cyan-300"/>Recent AI Lab</CardTitle><CardDescription>AI Lab sessions stay separate from canonical Zyntra attempts.</CardDescription></CardHeader><CardContent>
      {history.length ? <div className="space-y-2">{history.map((session) => <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"><div className="min-w-0"><div className="text-sm font-medium text-white">{session.mode === 'performance' ? 'Ask My Performance' : session.mode === 'questions' ? 'Generate Questions' : 'Weak Area Drill'}</div><div className="text-xs text-slate-500">{session.provider} · {session.model || 'model'} · {new Date(session.created_at).toLocaleString()}</div></div><Badge variant="outline" className="shrink-0">{session.status}</Badge></div>)}</div> : <div className="text-sm text-slate-400">No AI Lab sessions yet.</div>}
    </CardContent></Card>
    <p className="text-xs leading-5 text-slate-500">AI Lab is an experimental training environment. External AI outputs are not official AMC assessments and should be independently checked.</p>
  </div></AppLayout>;
}
