import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Stethoscope, CheckCircle2, XCircle, ArrowRight, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface MCQQuestion {
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
  category: string;
  difficulty: string;
  key_takeaways?: string[];
  differential_diagnoses?: string[];
}

interface OSCEStation {
  scenario_title: string;
  subject: string;
  patient_briefing: string;
  opening_statement: string;
  patient_history: Record<string, string>;
  checklist: { item: string; category: string; weight?: number }[];
  expected_diagnosis: string;
  key_findings?: string[];
}

export default function Feed() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'mcq' | 'osce'>('mcq');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [mcqResults, setMcqResults] = useState<MCQQuestion[] | null>(null);
  const [osceResult, setOsceResult] = useState<OSCEStation | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [savingMcq, setSavingMcq] = useState(false);
  const [savedMcq, setSavedMcq] = useState(false);
  const [savingOsce, setSavingOsce] = useState(false);
  const [savedOsce, setSavedOsce] = useState(false);

  if (!gate.canAccessAnalytics) {
    return (
      <AppLayout>
        <UpgradePrompt
          feature="Feed"
          description="Paste clinical content and generate practice questions or OSCE stations instantly."
        />
      </AppLayout>
    );
  }

  const handleGenerate = async () => {
    if (!content.trim()) {
      toast({ title: 'Please paste some content first', variant: 'destructive' });
      return;
    }
    if (!gate.canUsePrompt) {
      toast({ title: 'Daily prompt limit reached', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setMcqResults(null);
    setOsceResult(null);
    setSelectedAnswers({});
    setRevealedAnswers({});
    setSavedMcq(false);
    setSavedOsce(false);

    try {
      gate.recordPrompt();
      const { data, error } = await supabase.functions.invoke('feed-to-questions', {
        body: { content_text: content, type: tab },
      });

      if (error) throw error;

      if (tab === 'mcq' && data?.questions) {
        setMcqResults(data.questions);
      } else if (tab === 'osce' && data?.station) {
        setOsceResult(data.station);
      } else {
        throw new Error('Unexpected response format');
      }

      // Save to history
      if (user) {
        await supabase.from('feed_submissions').insert({
          user_id: user.id,
          content_text: content,
          feed_type: tab,
          generated_content: data,
        });
      }
    } catch (err: any) {
      console.error('Feed generation error:', err);
      const msg = err?.message || 'Generation failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (qIndex: number, option: string) => {
    if (revealedAnswers[qIndex]) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: option }));
  };

  const revealAnswer = (qIndex: number) => {
    setRevealedAnswers((prev) => ({ ...prev, [qIndex]: true }));
  };

  const handleSaveMcq = async () => {
    if (!mcqResults) return;
    setSavingMcq(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-feed-questions', {
        body: { type: 'mcq', questions: mcqResults },
      });
      if (error) throw error;
      setSavedMcq(true);
      toast({ title: `${data.saved} questions saved to question bank` });
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingMcq(false);
    }
  };

  const handleSaveOsce = async () => {
    if (!osceResult) return;
    setSavingOsce(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-feed-questions', {
        body: { type: 'osce', station: osceResult },
      });
      if (error) throw error;
      setSavedOsce(true);
      toast({ title: 'OSCE station saved to your stations' });
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingOsce(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-display">Feed</h1>
        <p className="text-muted-foreground">
          Paste clinical content and generate practice questions or OSCE stations instantly.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as 'mcq' | 'osce'); setMcqResults(null); setOsceResult(null); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="mcq" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" /> MCQ
          </TabsTrigger>
          <TabsTrigger value="osce" className="gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" /> OSCE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mcq">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Paste Clinical Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste any clinical content, case study, or topic notes here. The AI will generate exam-style MCQ questions from it..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[160px]"
              />
              <Button onClick={handleGenerate} disabled={loading || !content.trim()} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {loading ? 'Generating...' : 'Generate MCQ Questions'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="osce">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Paste Clinical Scenario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste a clinical scenario, patient presentation, or case description. The AI will generate a complete OSCE station from it..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[160px]"
              />
              <Button onClick={handleGenerate} disabled={loading || !content.trim()} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
                {loading ? 'Generating...' : 'Generate OSCE Station'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MCQ Results */}
      {mcqResults && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-bold font-display">Generated Questions ({mcqResults.length})</h2>
          <Button
            onClick={handleSaveMcq}
            disabled={savingMcq || savedMcq}
            variant={savedMcq ? 'secondary' : 'outline'}
            className="gap-2"
          >
            {savingMcq ? <Loader2 className="h-4 w-4 animate-spin" /> : savedMcq ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {savedMcq ? 'Saved to Question Bank' : 'Save All to Question Bank'}
          </Button>
          </div>
          {mcqResults.map((q, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{q.category}</Badge>
                  <Badge variant={q.difficulty === 'hard' ? 'destructive' : q.difficulty === 'easy' ? 'secondary' : 'default'}>
                    {q.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-base font-medium leading-relaxed">
                  Q{i + 1}. {q.question_text}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {Object.entries(q.options).map(([key, value]) => {
                    const isSelected = selectedAnswers[i] === key;
                    const isRevealed = revealedAnswers[i];
                    const isCorrect = key === q.correct_answer;
                    return (
                      <button
                        key={key}
                        onClick={() => selectAnswer(i, key)}
                        className={cn(
                          'w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors',
                          isRevealed && isCorrect && 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400',
                          isRevealed && isSelected && !isCorrect && 'border-destructive bg-destructive/10 text-destructive',
                          !isRevealed && isSelected && 'border-primary bg-primary/10',
                          !isRevealed && !isSelected && 'border-border hover:border-primary/50 hover:bg-muted/50',
                        )}
                      >
                        <span className="font-medium mr-2">{key}.</span>
                        {value}
                        {isRevealed && isCorrect && <CheckCircle2 className="inline ml-2 h-4 w-4" />}
                        {isRevealed && isSelected && !isCorrect && <XCircle className="inline ml-2 h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>

                {selectedAnswers[i] && !revealedAnswers[i] && (
                  <Button size="sm" variant="outline" onClick={() => revealAnswer(i)}>
                    Check Answer
                  </Button>
                )}

                {revealedAnswers[i] && (
                  <div className="mt-4 rounded-lg bg-muted/50 p-4 space-y-2">
                    <p className="text-sm font-medium">Explanation:</p>
                    <p className="text-sm text-muted-foreground">{q.explanation}</p>
                    {q.key_takeaways && q.key_takeaways.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Key Takeaways:</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                          {q.key_takeaways.map((t, j) => <li key={j}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* OSCE Result */}
      {osceResult && (
        <div className="mt-8 space-y-6">
          <h2 className="text-xl font-bold font-display">{osceResult.scenario_title}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Patient Briefing</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{osceResult.patient_briefing}</p>
                <p className="mt-3 text-sm italic text-muted-foreground">"{osceResult.opening_statement}"</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Expected Diagnosis</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-primary">{osceResult.expected_diagnosis}</p>
                {osceResult.key_findings && (
                  <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    {osceResult.key_findings.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Checklist ({osceResult.checklist.length} items)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {osceResult.checklist.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <span>{c.item}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{c.category}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => navigate('/stations')} className="gap-2">
            Practice OSCE Stations <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <p className="mt-8 text-[11px] text-muted-foreground/50 text-center">
        Also used by Zyntra for internal content development.
      </p>
    </AppLayout>
  );
}
