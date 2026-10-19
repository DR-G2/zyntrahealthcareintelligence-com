import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Database, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ResetMode = 'pie_only' | 'full_candidate';
type Preview = {
  mode: ResetMode;
  counts: Record<string, number>;
  total_rows: number;
  preview_token: string;
  confirmation_phrase: string;
  warning: string;
};

export function PIEBetaResetPanel() {
  const [mode, setMode] = useState<ResetMode>('pie_only');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const { toast } = useToast();

  const runPreview = async () => {
    setLoadingPreview(true);
    setPreview(null);
    setConfirmation('');
    try {
      const { data, error } = await supabase.rpc('admin_preview_pie_beta_reset', { p_mode: mode });
      if (error) throw error;
      if (!data?.preview_token || !data?.counts) throw new Error('Preview response was incomplete.');
      setPreview(data as Preview);
    } catch (e: any) {
      toast({ title: 'Reset preview failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setLoadingPreview(false);
    }
  };

  const executeReset = async () => {
    if (!preview || confirmation !== preview.confirmation_phrase || preview.mode !== mode) return;
    setExecuting(true);
    try {
      const { data, error } = await supabase.rpc('admin_execute_pie_beta_reset', {
        p_mode: mode,
        p_confirmation: confirmation,
        p_preview_token: preview.preview_token,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? 'Reset was not confirmed by the server.');
      toast({ title: 'Beta data reset completed', description: 'The server recorded the reset in the admin audit table.' });
      setPreview(null);
      setConfirmation('');
    } catch (e: any) {
      toast({ title: 'Reset failed safely', description: e?.message ?? 'The transaction may have been rolled back. Re-run preview before retrying.', variant: 'destructive' });
      setPreview(null);
      setConfirmation('');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Database className="h-4 w-4 text-destructive" />
          PIE Beta Data Reset
          <Badge variant="outline" className="border-warning/40 text-warning">Destructive · Super admin</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Preview row counts first. The server checks administrator access, requires a typed phrase, rechecks the preview fingerprint, and writes an audit record. This does not delete user accounts or question-bank content.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Select value={mode} onValueChange={(value) => { setMode(value as ResetMode); setPreview(null); setConfirmation(''); }}>
            <SelectTrigger aria-label="Reset scope"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pie_only">A · PIE-derived evidence only</SelectItem>
              <SelectItem value="full_candidate">B · All candidate attempts + PIE data</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={runPreview} disabled={loadingPreview || executing}>
            {loadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Preview impact
          </Button>
        </div>

        <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary" />{mode === 'pie_only' ? 'PIE-only reset' : 'Full candidate-data reset'}</div>
          {mode === 'pie_only'
            ? 'Clears PIE observations, decision traces, derived candidate state and intelligence telemetry. Canonical MCQ attempts and practice sessions are preserved.'
            : 'Clears PIE evidence, canonical MCQ attempts, practice-session membership and practice sessions for all candidates. Accounts, question content, LO mappings, model configuration and security records are preserved.'}
        </div>

        {preview && (
          <div className="space-y-3 rounded-md border border-destructive/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Preview result</p>
              <Badge variant="outline">{preview.total_rows.toLocaleString()} rows targeted</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{preview.warning}</p>
            <div className="max-h-56 overflow-y-auto rounded border border-border/60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left font-medium">Table</th><th className="p-2 text-right font-medium">Rows</th></tr></thead>
                <tbody>{Object.entries(preview.counts).map(([table, count]) => (
                  <tr key={table} className="border-t border-border/50"><td className="break-all p-2 font-mono">{table}</td><td className="p-2 text-right tabular-nums">{Number(count).toLocaleString()}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="space-y-2">
              <label htmlFor="pie-reset-confirm" className="text-xs font-medium">Type exactly: <span className="font-mono text-destructive">{preview.confirmation_phrase}</span></label>
              <Input id="pie-reset-confirm" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" placeholder={preview.confirmation_phrase} />
            </div>
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This action is irreversible. If any unexpected foreign-key dependency blocks the reset, the database transaction should roll back instead of partially clearing data.</span>
            </div>
            <Button variant="destructive" className="w-full" onClick={executeReset} disabled={executing || confirmation !== preview.confirmation_phrase}>
              {executing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Execute {mode === 'pie_only' ? 'PIE-only reset' : 'full candidate reset'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
