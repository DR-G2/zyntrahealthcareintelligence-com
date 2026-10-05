import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Brain, Activity, Target, GitBranch, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const pct = (v: unknown) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—';
const num = (v: unknown) => typeof v === 'number' ? v.toFixed(3) : '—';

export function PIEInspectionTab() {
  const [userId, setUserId] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const inspect = async () => {
    if (!userId.trim()) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-pie-inspect-user', {
        body: { user_id: userId.trim() },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e: any) {
      toast({ title: 'PIE inspection failed', description: e.message, variant: 'destructive' });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const state = data?.candidate_state;
  const dynamic = data?.dynamic_state;
  const readiness = data?.exam_readiness?.[0];
  const compatibility = data?.legacy_compatibility;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" /> PIE Inspection
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Admin-only view of the PIE state, uncertainty, dynamics, readiness, DWIG and decision trail.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="Candidate user ID"
              className="font-mono text-xs"
            />
            <Button onClick={inspect} disabled={loading || !userId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Inspect
            </Button>
          </div>
        </CardContent>
      </Card>

      {!data && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Enter a candidate user ID to inspect PIE.
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Capability</div><div className="text-xl font-semibold">{pct(state?.capability_estimate)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Decision</div><div className="text-xl font-semibold">{pct(state?.decision_estimate)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Timing</div><div className="text-xl font-semibold">{pct(state?.timing_estimate)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Calibration</div><div className="text-xl font-semibold">{pct(state?.calibration_estimate)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Sustained performance</div><div className="text-xl font-semibold">{pct(state?.sustained_performance_estimate)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Learning</div><div className="text-xl font-semibold">{pct(state?.learning_estimate)}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> State quality</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5 text-xs">
              <div><span className="text-muted-foreground">Status</span><div><Badge variant="outline">{state?.identification_status || '—'}</Badge></div></div>
              <div><span className="text-muted-foreground">Evidence</span><div>{state?.evidence_level || '—'}</div></div>
              <div><span className="text-muted-foreground">Observations</span><div>{state?.observation_count ?? '—'}</div></div>
              <div><span className="text-muted-foreground">Data quality</span><div>{pct(state?.data_quality)}</div></div>
              <div><span className="text-muted-foreground">Model</span><div className="font-mono">{state?.model_version || '—'}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4" /> Dynamics</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-6 text-xs">
              <div><span className="text-muted-foreground">Stability</span><div>{num(dynamic?.stability_estimate)}</div></div>
              <div><span className="text-muted-foreground">Recovery</span><div>{num(dynamic?.recovery_estimate)}</div></div>
              <div><span className="text-muted-foreground">Elasticity</span><div>{num(dynamic?.elasticity_estimate)}</div></div>
              <div><span className="text-muted-foreground">Inertia</span><div>{num(dynamic?.inertia_estimate)}</div></div>
              <div><span className="text-muted-foreground">Velocity</span><div>{num(dynamic?.velocity_estimate)}</div></div>
              <div><span className="text-muted-foreground">Change point</span><div>{pct(dynamic?.change_point_probability)}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4" /> Exam readiness</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-6 text-xs">
              <div><span className="text-muted-foreground">Target probability</span><div>{pct(readiness?.target_probability)}</div></div>
              <div><span className="text-muted-foreground">Lower</span><div>{pct(readiness?.lower_bound)}</div></div>
              <div><span className="text-muted-foreground">Upper</span><div>{pct(readiness?.upper_bound)}</div></div>
              <div><span className="text-muted-foreground">Uncertainty</span><div>{num(readiness?.uncertainty_measure)}</div></div>
              <div><span className="text-muted-foreground">Status</span><div>{readiness?.readiness_status || '—'}</div></div>
              <div><span className="text-muted-foreground">Model</span><div className="font-mono">{readiness?.model_version || '—'}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Compatibility</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="flex gap-2"><Badge variant="outline">{compatibility?.source_of_truth || 'LEGACY'}</Badge><Badge variant="secondary">{compatibility?.compatibility_status || 'SHADOW'}</Badge></div>
              <p className="text-muted-foreground">Legacy remains authoritative until PIE is explicitly validated and promoted.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">DWIG selections</CardTitle></CardHeader>
            <CardContent>
              {(data.dwig_selections || []).length === 0 ? <p className="text-xs text-muted-foreground">No DWIG selections.</p> : (
                <div className="space-y-2">{data.dwig_selections.map((x: any) => (
                  <div key={x.id} className="rounded-md border p-3 text-xs">
                    <div className="font-medium">{x.decision_context}</div>
                    <div className="text-muted-foreground">Expected uncertainty reduction: {num(x.expected_decision_uncertainty_reduction)}</div>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Decision trail</CardTitle></CardHeader>
            <CardContent>
              {(data.decisions || []).length === 0 ? <p className="text-xs text-muted-foreground">No decisions.</p> : (
                <div className="space-y-2">{data.decisions.map((x: any) => (
                  <div key={x.id} className="rounded-md border p-3 text-xs">
                    <div className="font-medium">{x.decision_context}</div>
                    <div className="text-muted-foreground">Expected utility: {num(x.expected_utility)} · Uncertainty: {num(x.decision_uncertainty)}</div>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Validation runs</CardTitle></CardHeader>
            <CardContent>
              {(data.validation_runs || []).length === 0 ? <p className="text-xs text-muted-foreground">No validation runs registered.</p> : (
                <div className="space-y-2">{data.validation_runs.map((x: any) => (
                  <div key={x.id} className="rounded-md border p-3 text-xs flex items-center justify-between gap-3">
                    <span className="font-mono">{x.validation_run_code}</span>
                    <Badge variant="outline">{x.status}</Badge>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
