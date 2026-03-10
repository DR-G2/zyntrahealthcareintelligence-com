import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Brain, RefreshCw, Loader2, ChevronDown, Server, Database, Zap, Bug } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface AggregateData {
  mcq?: {
    total_attempts?: number;
    overall_accuracy?: number;
    avg_time_seconds?: number;
    avg_answer_changes?: number;
    change_rate_percent?: number;
    category_pass_rates?: { category: string; accuracy: number; sample: number }[];
  };
  behavior?: {
    archetype_distribution?: Record<string, number>;
    common_traps?: { trap: string; count: number; percent: number }[];
  };
  osce?: {
    total_stations?: number;
    avg_score?: number;
    subject_stats?: { subject: string; avg_score: number; count: number }[];
  };
  generated_at?: string;
}

export function AIControlTab() {
  const { toast } = useToast();
  const [data, setData] = useState<AggregateData | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  // Feature weights (visual only, stored in localStorage)
  const [weights, setWeights] = useState(() => {
    const saved = localStorage.getItem('zyntra_ai_weights');
    return saved ? JSON.parse(saved) : { accuracy: 70, stability: 60, efficiency: 50, calibration: 55 };
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: row } = await supabase
      .from('ai_training_context')
      .select('aggregate_data, candidate_count, updated_at')
      .limit(1)
      .maybeSingle();
    if (row) {
      setData(row.aggregate_data as unknown as AggregateData);
      setCandidateCount(row.candidate_count ?? 0);
      setUpdatedAt(row.updated_at);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    localStorage.setItem('zyntra_ai_weights', JSON.stringify(weights));
  }, [weights]);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('retrain-ai-context');
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast({ title: 'Retrained successfully', description: `${res.candidate_count} candidates processed` });
      fetchData();
    } catch (e: any) {
      toast({ title: 'Retrain failed', description: e.message, variant: 'destructive' });
    }
    setRetraining(false);
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('retrain-ai-context');
      if (error) throw error;
      toast({ title: 'Recomputed', description: 'Behavioral metrics rebuilt' });
      fetchData();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
    setRecomputing(false);
  };

  const totalInteractions = (data?.mcq?.total_attempts ?? 0) + (data?.osce?.total_stations ?? 0);

  return (
    <div className="space-y-6">
      {/* System Monitoring */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5 text-primary" /> AI System Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Active Model</div>
              <div className="font-semibold text-sm mt-1">gemini-2.5-pro</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Model Version</div>
              <div className="font-semibold text-sm mt-1">v1.0</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total Interactions</div>
              <div className="font-semibold text-sm mt-1">{loading ? '...' : totalInteractions.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Candidates</div>
              <div className="font-semibold text-sm mt-1">{loading ? '...' : candidateCount.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Dataset Size</div>
              <div className="font-semibold text-sm mt-1">{loading ? '...' : `${(data?.mcq?.total_attempts ?? 0).toLocaleString()} MCQ + ${(data?.osce?.total_stations ?? 0).toLocaleString()} OSCE`}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Last Trained</div>
              <div className="font-semibold text-sm mt-1">{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" /> AI Training Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-3">
            <Button onClick={handleRetrain} disabled={retraining}>
              {retraining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Retrain AI
            </Button>
            <Button variant="outline" onClick={handleRecompute} disabled={recomputing}>
              {recomputing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Rebuild Feature Dataset
            </Button>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Feature Weights</h4>
            {[
              { key: 'accuracy', label: 'Clinical Accuracy' },
              { key: 'stability', label: 'Answer Stability' },
              { key: 'efficiency', label: 'Time Efficiency' },
              { key: 'calibration', label: 'Confidence Calibration' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs">{weights[key]}%</span>
                </div>
                <Slider
                  value={[weights[key]]}
                  onValueChange={([v]) => setWeights((prev: Record<string, number>) => ({ ...prev, [key]: v }))}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Processing Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" /> Data Processing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={handleRetrain} disabled={retraining}>
              Recompute Behavioral Metrics
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              localStorage.removeItem('zyntra_ai_weights');
              setWeights({ accuracy: 70, stability: 60, efficiency: 50, calibration: 55 });
              toast({ title: 'Cache reset' });
            }}>
              Reset Model Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel */}
      <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bug className="h-5 w-5 text-primary" /> Debug Panel
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {data?.behavior?.archetype_distribution && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Archetype Distribution</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.behavior.archetype_distribution).map(([arch, count]) => (
                      <Badge key={arch} variant="outline">{arch}: {count}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {data?.behavior?.common_traps && data.behavior.common_traps.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Common Traps</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.behavior.common_traps.map((t) => (
                      <Badge key={t.trap} variant="secondary">{t.trap} ({t.percent}%)</Badge>
                    ))}
                  </div>
                </div>
              )}
              {data?.mcq?.category_pass_rates && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Category Pass Rates</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {data.mcq.category_pass_rates.map((c) => (
                      <div key={c.category} className="flex justify-between border rounded px-2 py-1">
                        <span className="text-muted-foreground">{c.category}</span>
                        <span className="font-mono">{c.accuracy}% (n={c.sample})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-2">Raw Aggregate Data</h4>
                <pre className="rounded-lg bg-muted p-3 text-xs overflow-auto max-h-64">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
