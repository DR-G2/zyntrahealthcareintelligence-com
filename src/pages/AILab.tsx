import { useMemo, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Sparkles, Target, Link2, Unplug, Loader2, History, ShieldCheck } from 'lucide-react';

type Mode = 'performance' | 'questions' | 'weak-area';
const MODES = [
  { id: 'performance' as const, label: 'Ask My Performance', description: 'Ask questions about your current training patterns.', icon: MessageSquare },
  { id: 'questions' as const, label: 'Generate Questions', description: 'Create AI-generated AMC-style practice questions.', icon: Sparkles },
  { id: 'weak-area' as const, label: 'Weak Area Drill', description: 'Turn current weak areas into a focused training session.', icon: Target },
];

export default function AILab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('performance');
  const [useIntelligence, setUseIntelligence] = useState(true);
  const [connected, setConnected] = useState(false);
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [subject, setSubject] = useState('');
  const [focus, setFocus] = useState('');
  const [difficulty, setDifficulty] = useState('moderate');
  const [questionCount, setQuestionCount] = useState('5');
  const [loading, setLoading] = useState(false);
  const canRun = useMemo(() => connected && !!model && (mode !== 'performance' || !!prompt.trim()) && (mode !== 'questions' || !!subject.trim()), [connected, model, mode, prompt, subject]);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('ai-lab', { body });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'AI Lab request failed');
    return data;
  };

  const connect = async () => {
    if (!apiKey.trim()) return toast({ title: 'API key required', description: 'Enter your OpenAI API key.', variant: 'destructive' });
    setLoading(true);
    try {
      const data = await invoke({ action: 'connect', provider: 'openai', api_key: apiKey.trim() });
      setConnected(true);
      setModel(data.model || 'gpt-5.6');
      setApiKey('');
      toast({ title: 'OpenAI connected', description: 'Connection verified on the server.' });
    } catch (e: any) {
      toast({ title: 'Connection failed', description: e?.message || 'Unable to verify the provider.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const disconnect = async () => {
    setLoading(true);
    try { await invoke({ action: 'disconnect', provider: 'openai' }); setConnected(false); setModel(''); toast({ title: 'OpenAI disconnected' }); }
    catch (e: any) { toast({ title: 'Disconnect failed', description: e?.message || 'Please try again.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const run = async () => {
    if (!canRun) return;
    setLoading(true);
    try {
      await invoke({
        action: 'run', provider: 'openai', model, mode, use_intelligence: useIntelligence,
        prompt: mode === 'performance' ? prompt.trim() : undefined,
        generation: mode === 'questions' ? { subject: subject.trim(), focus: focus.trim(), difficulty, count: Number(questionCount) } : undefined,
      });
      toast({ title: 'AI Lab session complete' });
      if (mode === 'performance') setPrompt('');
    } catch (e: any) {
      toast({ title: 'AI Lab error', description: e?.message || 'Unable to complete the session.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return <AppLayout><div className="space-y-6">
    <RoomHeader kind="ai-lab" />
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <Card className="border-white/10 bg-[#081224]/70">
          <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-cyan-300" />Connected AI</CardTitle><CardDescription>V1 uses OpenAI with your own provider credential.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {!connected ? <><div className="space-y-2"><Label htmlFor="openai-key">OpenAI API key</Label><Input id="openai-key" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-••••••••" /><p className="text-xs text-slate-500">The key is sent directly to the secure AI Lab function and is not stored by the browser.</p></div><Button onClick={connect} disabled={loading} className="w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Test & Connect</Button></> :
            <><div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"><div><div className="text-sm font-medium text-white">OpenAI</div><div className="text-xs text-slate-400">Connection verified</div></div><Badge variant="outline" className="border-emerald-400/30 text-emerald-300">Connected</Badge></div>
            <div className="space-y-2"><Label>Model</Label><Select value={model} onValueChange={setModel}><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger><SelectContent><SelectItem value="gpt-5.6">GPT-5.6</SelectItem><SelectItem value="gpt-5-mini">GPT-5 mini</SelectItem></SelectContent></Select></div>
            <Button variant="outline" onClick={disconnect} disabled={loading} className="w-full"><Unplug className="mr-2 h-4 w-4" />Disconnect</Button></>}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#081224]/70">
          <CardHeader><CardTitle>Training Context</CardTitle><CardDescription>Use a bounded view of your Zyntra Performance Intelligence.</CardDescription></CardHeader>
          <CardContent className="flex items-center justify-between gap-4"><div><div className="text-sm font-medium text-white">Use my Performance Intelligence</div><div className="text-xs leading-5 text-slate-400">Selected performance signals only. No direct database access.</div></div><Switch checked={useIntelligence} onCheckedChange={setUseIntelligence} /></CardContent>
        </Card>
      </div>
      <Card className="border-white/10 bg-[#081224]/70">
        <CardHeader><div className="flex flex-wrap gap-2">{MODES.map(({id,label,icon:Icon}) => <Button key={id} size="sm" variant={mode===id?'default':'outline'} onClick={()=>setMode(id)} className="gap-2"><Icon className="h-4 w-4"/>{label}</Button>)}</div><CardTitle className="mt-4">{MODES.find(m=>m.id===mode)?.label}</CardTitle><CardDescription>{MODES.find(m=>m.id===mode)?.description}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {mode==='performance' && <div className="space-y-2"><Label htmlFor="ai-prompt">Ask your question</Label><Textarea id="ai-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Why am I losing marks?" className="min-h-32"/></div>}
          {mode==='questions' && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Adult Medicine"/></div><div className="space-y-2"><Label>Focus / subtopic</Label><Input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="Acute coronary syndrome"/></div><div className="space-y-2"><Label>Difficulty</Label><Select value={difficulty} onValueChange={setDifficulty}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="difficult">Difficult</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Questions</Label><Select value={questionCount} onValueChange={setQuestionCount}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="3">3</SelectItem><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem></SelectContent></Select></div></div>}
          {mode==='weak-area' && <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-4 text-sm text-slate-300">Zyntra will select the training focus from your current Performance Intelligence context.</div>}
          <Button className="w-full" onClick={run} disabled={loading || !canRun}><Sparkles className="mr-2 h-4 w-4"/>{loading?'Running…':'Start AI Session'}</Button>
        </CardContent>
      </Card>
    </div>
    <Card className="border-white/10 bg-[#081224]/70"><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4 text-cyan-300"/>Recent AI Lab</CardTitle><CardDescription>AI Lab sessions stay separate from canonical Zyntra attempts.</CardDescription></CardHeader><CardContent><div className="text-sm text-slate-400">Session history will appear here once the backend is connected.</div></CardContent></Card>
    <p className="text-xs leading-5 text-slate-500">AI Lab is an experimental training environment. External AI outputs are not official AMC assessments and should be independently checked.</p>
  </div></AppLayout>;
}
